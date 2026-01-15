// var express = require("express");
const http = require("http");
const mqtt = require('mqtt');
const config = require('/config/systemair-config');

const client = mqtt.connect(config.mqttUrl, config.mqttOptions)
const deviceHost = config.systemairIamHost
const deviceName = config.systemairDeviceName

const mqttSensorTopic = `homeassistant/sensor/${deviceName}`
const mqttNumberTopic = `homeassistant/number/${deviceName}`
const mqttSelectTopic = `homeassistant/select/${deviceName}`
const mqttAvailabilityTopic = `systemair/bridge/state`

const mqttStateTopic = `${mqttSensorTopic}/state`
const mqttNumberStateTopic = `${mqttNumberTopic}/state`
const mqttSelectStateTopic = `${mqttSelectTopic}/state`

const registers = [
  { name: "outdoor air temperature", register: 12101, decimals: 1, device_class: "temperature" },
  { name: "supply air temperature", register: 12102, decimals: 1, device_class: "temperature" },
  { name: "indoor extract air temperature", register: 12543, decimals: 1, device_class: "temperature" },
  { name: "supply fan speed", register: 12400, decimals: 0, device_class: "speed" },
  { name: "extract fan speed", register: 12401, decimals: 0, device_class: "speed" },
  { name: "humidity", register: 12135, decimals: 0, device_class: "humidity" },
];

const configRegisters = [
  { register: 1400, name: "minium airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1401, name: "minium airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1402, name: "low airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1403, name: "low airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1404, name: "normal airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1405, name: "normal airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1406, name: "high airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1407, name: "high airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1408, name: "max airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 1409, name: "max airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0},
  { register: 2000, name: "temperature setpoint", decimals: 1, min:12, max:30, unit_of_measurement:"°C", step: 1, device_class: "temperature" },
];

const mapValueToName = (options, value) => {
  const idxAdjusted = value + 1
  const relevantOption = options.find((o) => o.value == idxAdjusted)
  return relevantOption.name;
}

const mapNonAdjustedValueToName = (options, value) => {
  const relevantOption = options.find((o) => o.value == value)
  return relevantOption.name;
}

const selectRegisters = [
  { register: 1160, updateRegister: 1161, name: "usermode", toHaValue: mapValueToName, options: [
    { value: 1, name: "auto" },
    { value: 2, name: "manual" },
    { value: 3, name: "crowded" },
    { value: 4, name: "refresh" },
    { value: 5, name: "fireplace" },
    { value: 6, name: "away" },
    { value: 7, name: "vacation" },
  ]},
  { register: 1130, updateRegister: 1130, name: "airflow", toHaValue: mapNonAdjustedValueToName, options: [
    { value: 0, name: "off" },
    { value: 2, name: "low" },
    { value: 3, name: "normal" },
    { value: 4, name: "high" },
  ]},
];

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello, World!\n');
});

const selectRegisterToEntity = (register) => {
  return {
    name: capitalizeFirstLetter(register.name),
    command_topic: `${mqttSelectTopic}/${register.updateRegister}/set`,
    state_topic: mqttSelectStateTopic,
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
    command_topic: `${mqttNumberTopic}/${register.register}/set`,
    state_topic: mqttNumberStateTopic,
    value_template: `{{ value_json.result_${register.register}}}`,
    unique_id: `systemair-config-${deviceName}-${register.register}`,
    device: {
      identifiers: [deviceName],
      name: capitalizeFirstLetter(deviceName.replace(/_/g," "))
    }
  }
}

const registerToEntity = (register) => {
  const entity = {
    name: capitalizeFirstLetter(register.name),
    device_class: register.device_class,
    state_topic: `${mqttStateTopic}/state/${register.register}`,
    availability_topic: `${mqttAvailabilityTopic}/availability/${register.register}`,
    availability_template: `{{ value_json.status_${register.register}}}`,
    unique_id: `systemair-${deviceName}-${register.register}`,
    value_template: `{{ value_json.result_${register.register}}}`,
    device: {
      identifiers: [deviceName],
      name: capitalizeFirstLetter(deviceName.replace(/_/g," "))
    }
  }
  return entity;
}

const readRegisters = (registers, stateTopic) => {
  log(`attempting to read ${registers.length} and publish results to ${stateTopic}`)
  const encodedRegisters = `{${registers.map((reg) => `"${reg.register}":1`).join(",")}}`
  http
    .request({ host: deviceHost, path: `/mread?${encodedRegisters}` }, (response) => {
      publishEntityStatus(registers, 'online');
      handleResponse(response, registers, stateTopic)
    }).on("error", (err) => {
      log(`received error reading registers: ${err}. exiting...`)
      publishEntityStatus(registers, 'offline')
      process.exit(1)
    }).end();

}

const publishEntityStatus = (registers, status) => {
  registers.forEach((register) => {
    const registerStatus = {}
    registerStatus[`status_${register.register}`] = status

    const availability = `${mqttAvailabilityTopic}/register/${register.register}`
    log(`publishing availability for registers ${JSON.stringify(registerStatus)} status: ${status} to topic: ${availability}`)
    client.publish(availability, JSON.stringify(registerStatus));
  });
}

const registerDevicesMqtt = (systemairRegisters, numberEntities, selectRegisters) => {
  systemairRegisters.forEach(register => {
    const entityConfigTopic = `${mqttSensorTopic}/${register.name.replace(/ /g,"_")}/config`
    const entity = registerToEntity(register)
    log(`[${entityConfigTopic}] registering entity: ${entity.name}`)
    client.publish(entityConfigTopic, JSON.stringify(entity));
    //client.publish(`${mqttSensorTopic}/config`, '');
  });

  numberEntities.forEach(register => {
    const entityNumberConfigTopic = `${mqttNumberTopic}/${register.name.replace(/ /g,"_")}/config`
    const numberEntity = configRegisterToNumberEntity(register)
    log(`[${entityNumberConfigTopic}] registering config entity: ${numberEntity.name}`)
    client.publish(entityNumberConfigTopic, JSON.stringify(numberEntity));
    // client.publish(entityNumberConfigTopic, '');
  });

  selectRegisters.forEach(register => {
    const selectConfigTopic = `${mqttSelectTopic}/${register.name.replace(/ /g,"_")}/config`
    const selectEntity = selectRegisterToEntity(register)
    log(`[${selectConfigTopic}] registering select entity: ${selectEntity.name}`)
    client.publish(selectConfigTopic, JSON.stringify(selectEntity));
    // client.publish(entityNumberConfigTopic, '');
  });
};

const setupSelectSubscriptions = (selectRegisters) => {
  selectRegisters.forEach((register) => {
    client.subscribe(`${mqttSelectTopic}/${register.updateRegister}/set`, (err) => {
      if (err) {
        log(`unable to subscribe to topic for register ${register.updateRegister}`)
      } else {
        log(`successfully subscribed to topic for register ${register.updateRegister}`);
      }
    });
  });

  client.on('message', (topic, message) => {
    log(`received message on topic ${topic}. message: ${message}`);
    if (topic.indexOf(mqttSelectTopic) > -1) {
      const register = topic.replace(`${mqttSelectTopic}/`, "").replace("/set", "")
      updateSelect(register, message.toString(), selectRegisters)
    }
  });
};

const setupConfigSubscriptions = (configRegisters) => {
  configRegisters.forEach((register) => {
    client.subscribe(`${mqttNumberTopic}/${register.register}/set`, (err) => {
      if (err) {
        log(`unable to subscribe to topic for register ${register.register}`)
      } else {
        log(`successfully subscribed to topic for register ${register.register}`);
      }
    });
  });

  client.on('message', (topic, message) => {
    log(`received message on topic ${topic}. message: ${message}`);
    if (topic.indexOf(mqttNumberTopic) > -1) {
      const register = topic.replace(`${mqttNumberTopic}/`, "").replace("/set", "")
      updateDevice(register, message.toString(), configRegisters)
    }
  });
};

const updateSelect = (register, valueName, selectRegisters) => {
  const relevantRegister = selectRegisters.find((p) => p.updateRegister == register)
  const optionChosen = relevantRegister.options.find((o) => o.name == valueName)
  const value = optionChosen.value
  updateDevice(register, value, selectRegisters)
}

const updateDevice = (register, rawValue, registers) => {
  const relevantRegister = registers.find((p) => p.register == register)

  let factor = 1
  if (relevantRegister.decimals > 0) {
    factor = relevantRegister.decimals * 10
  }
  const value = rawValue * factor

  const encodedRequestParam = `{%22${register}%22:${value}}`
  log(`received request to update register ${register}`)
  http
    .request({ host: deviceHost, path: `/mwrite?${encodedRequestParam}` }, (response) => {
      log(`[register: ${register}] updated. new value: ${value}`)
     })
    .on("error", (err) => {
      publishEntityStatus([relevantRegister], 'offline');
      log(`received error: ${err}`)
    })
    .end();
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
const updateRegisters = () => {
  readRegisters(registers, mqttStateTopic)
  setTimeout(() => {
    readRegisters(configRegisters, mqttNumberStateTopic)
  }, 5000);
  setTimeout(() => {
    readRegisters(selectRegisters, mqttSelectStateTopic)
  }, 10000);
}

server.listen(3000, () => {
  client.on('connect', function () {
    log('Connected to MQTT. Registering devices.')
    registerDevicesMqtt(registers, configRegisters, selectRegisters);

    log(`Device registered with ${registers.length} read-only entities.`)
    log(`Registered ${configRegisters.length} number configuration entities`)
    log(`Registered ${selectRegisters.length} select entities`)

    setupConfigSubscriptions(configRegisters);
    setupSelectSubscriptions(selectRegisters);

    subscribeToHomeAssistantUpdates()
  });

  setInterval(updateRegisters, 60000);

  log('Server running on port 3000');
});

const readRegister = (relevantReg, register, response) => {
  const rawValue = response[register]
  let parsedValue
  if (rawValue > 32767) {
    parsedValue = rawValue - 65536
  } else {
    parsedValue = rawValue
  }

  var value
  if (relevantReg.decimals > 0) {
      value = (parsedValue / (10 * relevantReg.decimals)).toFixed(relevantReg.decimals)
  } else {
      value = parsedValue
  }

  return value
}

const handleResponse = function (response, registersToUse, topic) {
  var str = "";

  //another chunk of data has been recieved, so append it to `str`
  response.on("data", function (chunk) {
    str += chunk;
  });

  response.on("end", function () {
    const response = JSON.parse(str);

    Object.keys(response).forEach((register) => {
      const relevantReg = registersToUse.find((p) => `${p.register}` === register)
      let value
      if (relevantReg.toHaValue !== undefined) {
        const rawValue = response[register]
        value = relevantReg.toHaValue(relevantReg.options, rawValue)
      } else {
        value = readRegister(relevantReg, register, response);
      }

      const result = {}
      result[`result_${relevantReg.register}`] = value
      client.publish(`${topic}/state/${relevantReg.register}`, JSON.stringify(result))
    });
  });
};

const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`)
}
