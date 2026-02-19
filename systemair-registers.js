
const registers = [
    { name: "outdoor air temperature", register: 12101, decimals: 1, device_class: "temperature", type: "sensor"},
    { name: "supply air temperature", register: 12102, decimals: 1, device_class: "temperature", type: "sensor"},
    { name: "indoor extract air temperature", register: 12543, decimals: 1, device_class: "temperature", type: "sensor"},
    { name: "supply fan speed", register: 12400, decimals: 0, device_class: "speed", type: "sensor"},
    { name: "extract fan speed", register: 12401, decimals: 0, device_class: "speed", type: "sensor"},
    { name: "humidity", register: 12135, decimals: 0, device_class: "humidity", type: "sensor"},
];

const configRegisters = [
    { register: 1400, name: "minium airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1401, name: "minium airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1402, name: "low airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1403, name: "low airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1404, name: "normal airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1405, name: "normal airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1406, name: "high airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1407, name: "high airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1408, name: "max airflow level supply", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 1409, name: "max airflow level extract", min: 16, max:100, unit_of_measurement: "%", step: 1, decimals: 0, type: "number"},
    { register: 2000, name: "temperature setpoint", decimals: 1, min:12, max:30, unit_of_measurement:"°C", step: 1, device_class: "temperature", type: "number"},
];

const mapValueToName = (options, value) => {
    const idxAdjusted = value + 1
    const relevantOption = options.find((o) => o.value === idxAdjusted)
    return relevantOption.name;
}

const mapNonAdjustedValueToName = (options, value) => {
    const relevantOption = options.find((o) => o.value === value)
    return relevantOption.name;
}

const selectRegisters = [
    { register: 1160, updateRegister: 1161, name: "usermode", type: "select", toHaValue: mapValueToName, options: [
            { value: 1, name: "auto" },
            { value: 2, name: "manual" },
            { value: 3, name: "crowded" },
            { value: 4, name: "refresh" },
            { value: 5, name: "fireplace" },
            { value: 6, name: "away" },
            { value: 7, name: "vacation" },
        ]},
    { register: 1130, updateRegister: 1130, name: "airflow", type: "select", toHaValue: mapNonAdjustedValueToName, options: [
            { value: 0, name: "off" },
            { value: 2, name: "low" },
            { value: 3, name: "normal" },
            { value: 4, name: "high" },
        ]},
];

const getAvailabilityTopic = (deviceName, register) => {
    return sanitizeTopicName(`systemair/${deviceName}/${register.name}/availability`)
}
const getStateTopic = (deviceName, register) => {
    return sanitizeTopicName(`systemair/${deviceName}/${register.name}/state`)
}
const getCommandTopic = (deviceName, register) => {
    return sanitizeTopicName(`systemair/${deviceName}/${register.name}/set`)
}
/** Used for autodiscovery */
const getConfigTopic = (deviceName, register) => {
    return sanitizeTopicName(`homeassistant/${register.type}/${deviceName}/${register.name}/config`)
}
const sanitizeTopicName = (topic) => {
    return topic.replace(/ /g,"_")
}

module.exports = {
    selectRegisters, configRegisters, registers, getConfigTopic, getStateTopic, getCommandTopic, getAvailabilityTopic, sanitizeTopicName
}
