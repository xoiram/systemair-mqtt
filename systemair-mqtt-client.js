const {log} = require("./utils");
const mqtt = require('mqtt');
const {registers, configRegisters, selectRegisters, getStateTopic, getConfigTopic, getCommandTopic,
    getAvailabilityTopic
} = require("./systemair-registers");

require('dotenv').config();

const mqttUrl = process.env.MQTT_URL || 'mqtt://localhost:1883';
const mqttUsername = process.env.MQTT_USERNAME;
const mqttPassword = process.env.MQTT_PASSWORD;
const mqttClientId = "systemair-iam-client";
const deviceName = process.env.SYSTEMAIR_DEVICE_NAME || 'systemair';

const mqttOptions = {
    username: mqttUsername,
    password: mqttPassword,
    clientId: mqttClientId,
}
const client = mqtt.connect(mqttUrl, mqttOptions)
const lastValues = {}
const topicRegisters = {}
const topicRegistersType = {}

const initialize = (updateDevice) => {
    log("connecting to mqtt...")
    client.on('connect', function () {
        log('Connected to MQTT. Registering devices.')
        registerDevicesMqtt(registers, configRegisters, selectRegisters);

        log(`Device registered with ${registers.length} read-only entities.`)
        log(`Registered ${configRegisters.length} number configuration entities`)
        log(`Registered ${selectRegisters.length} select entities`)

        setupConfigSubscriptions(configRegisters);
        setupSelectSubscriptions(selectRegisters);
        setupMessageHandling(updateDevice);

        subscribeToHomeAssistantUpdates()
    })
}

const subscribeToHomeAssistantUpdates = () => {
    client.subscribe(`homeassistant/status`, (err) => {
        if (err) {
            log("unable to subscribe to HA updates")
        } else {
            log("subscribed to HA status updates")
        }
    })

    client.on('message', (topic, message) => {
        log(`received message on topic ${topic}. message: ${message}`);
        if (topic === "homeassistant/status") {
            if (message.toString() === 'online') {
                registerDevicesMqtt(registers, configRegisters, selectRegisters);
            }
        }
    });
}

const selectRegisterToEntity = (register) => {
    return {
        name: capitalizeFirstLetter(register.name),
        command_topic: getCommandTopic(deviceName, register),
        state_topic: getStateTopic(deviceName, register),
        options: register.options.map(ro => ro.name),
        value_template: `{{ value_json.result_${register.register}}}`,
        unique_id: `systemair-select-${deviceName}-${register.register}`,
        device: {
            identifiers: [deviceName],
            name: capitalizeFirstLetter(deviceName.replace(/_/g," "))
        }
    }
}

const configRegisterToNumberEntity = (register) => {
    return {
        name: capitalizeFirstLetter(register.name),
        min: register.min,
        max: register.max,
        step: register.step,
        entity_category: 'config',
        unit_of_measurement: register.unit_of_measurement,
        command_topic: getCommandTopic(deviceName, register),
        state_topic: getStateTopic(deviceName, register),
        value_template: `{{ value_json.result_${register.register}}}`,
        unique_id: `systemair-config-${deviceName}-${register.register}`,
        device: {
            identifiers: [deviceName],
            name: capitalizeFirstLetter(deviceName.replace(/_/g," "))
        }
    }
}

const registerToEntity = (register) => {
    return {
        name: capitalizeFirstLetter(register.name),
        device_class: register.device_class,
        state_topic: getStateTopic(deviceName, register),
        availability_topic: getAvailabilityTopic(deviceName, register),
        availability_template: `{{ value_json.status_${register.register}}}`,
        unique_id: `systemair-${deviceName}-${register.register}`,
        value_template: `{{ value_json.result_${register.register}}}`,
        device: {
            identifiers: [deviceName],
            name: capitalizeFirstLetter(deviceName.replace(/_/g, " "))
        }
    };
}

const publishUpdateIfChanged = (register, value) => {
    const result = {}
    result[`result_${register.register}`] = value
    const topic = getStateTopic(deviceName, register)
    if (value !== lastValues[register.register]) {
        log(`publishing updated value for register ${register.name}. new value is: ${value}`)
        lastValues[register.register] = value
        client.publish(topic, JSON.stringify(result))
    }
}

const publishEntityStatus = (registers, status) => {
    log(`marking ${registers.map(r => r.name).join()} as ${status}`)
    registers.forEach((register) => {
        const registerStatus = {}
        registerStatus[`status_${register.register}`] = status
        const availabilityTopic = getAvailabilityTopic(deviceName, register)
        log(`publishing availability for registers ${JSON.stringify(registerStatus)} status: ${status} to topic: ${availabilityTopic}`)
        client.publish(availabilityTopic, JSON.stringify(registerStatus));
    });
}

const registerDevicesMqtt = (systemairRegisters, numberEntities, selectRegisters) => {
    systemairRegisters.forEach(register => {
        const entityConfigTopic = getConfigTopic(deviceName, register)
        const entity = registerToEntity(register)
        log(`[${entityConfigTopic}] registering entity: ${entity.name}`)
        client.publish(entityConfigTopic, JSON.stringify(entity));
    });

    numberEntities.forEach(register => {
        const entityConfigTopic = getConfigTopic(deviceName, register)
        const numberEntity = configRegisterToNumberEntity(register)
        log(`[${entityConfigTopic}] registering config entity: ${numberEntity.name}`)
        client.publish(entityConfigTopic, JSON.stringify(numberEntity));
    });

    selectRegisters.forEach(register => {
        const selectConfigTopic = getConfigTopic(deviceName, register)
        const selectEntity = selectRegisterToEntity(register)
        log(`[${selectConfigTopic}] registering select entity: ${selectEntity.name}`)
        client.publish(selectConfigTopic, JSON.stringify(selectEntity));
    });
};

const setupSelectSubscriptions = (selectRegisters) => {
    selectRegisters.forEach((register) => {
        const commandTopic = getCommandTopic(deviceName, register)
        client.subscribe(commandTopic, (err) => {
            if (err) {
                log(`unable to subscribe to topic for register ${register.updateRegister}`)
            } else {
                topicRegisters[commandTopic] = register
                topicRegistersType[commandTopic] = "command"
                log(`successfully subscribed to topic for register ${register.updateRegister}`);
            }
        });
    });
};

const setupConfigSubscriptions = (configRegisters) => {
    configRegisters.forEach((register) => {
        const configTopic = getConfigTopic(deviceName, register)
        client.subscribe(configTopic, (err) => {
            if (err) {
                log(`unable to subscribe to topic for register ${register.register}`)
            } else {
                topicRegisters[configTopic] = register
                topicRegistersType[configTopic] = "config"
                log(`successfully subscribed to topic for register ${register.register}`);
            }
        });
    });
};

const setupMessageHandling = (updateDevice) => {
    client.on('message', (topic, message) => {
        log(`received message on topic ${topic}. message: ${message}`);

        const register = topicRegisters[topic]
        const topicType = topicRegistersType[topic]

        if (topicType === "config") {
            updateDevice(register, message.toString(), configRegisters)
        } else if (topicType === "command") {
            updateSelect(register, message.toString(), selectRegisters, updateDevice)
        } else {
            log(`received message on unknown topic: ${topic}`)
        }
    });
};

const updateSelect = (register, valueName, selectRegisters, updateDevice) => {
    const relevantRegister = selectRegisters.find((p) => p.updateRegister === register.register)

    if (relevantRegister !== undefined && relevantRegister !== null) {
        const optionChosen = relevantRegister.options.find((o) => o.name === valueName)
        const value = optionChosen.value
        updateDevice(register, value, selectRegisters)
    } else {
        log(`unable to find relevant register to update. known registers: ${JSON.stringify(selectRegisters)} requested register: ${JSON.stringify(register)}`)
    }
}

const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
    initialize,
    publishUpdateIfChanged,
    publishEntityStatus,
}
