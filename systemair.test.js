const systemairRegisters = require('./systemair-registers');
const {getConfigTopic, getCommandTopic, sanitizeTopicName} = require("./systemair-registers");

// Extract exported components
const {
    selectRegisters, configRegisters, registers, getStateTopic, getAvailabilityTopic,
} = systemairRegisters;

describe('Systemair MQTT Topic Generation', () => {
    describe('state topics', () => {
        registers.forEach(reg => {
            const expectedName = sanitizeTopicName(reg.name)
            test(`should generate correct state topics for ${reg.name}`, () => {
                const entityValueTopic = getStateTopic("test", reg)
                expect(entityValueTopic).toEqual(expect.not.stringContaining(" "));
                expect(entityValueTopic).toBe(`systemair/test/${expectedName}/state`)
            })
            test(`should generate correct availability topics for ${reg.name}`, () => {
                const availabilityTopic = getAvailabilityTopic("test", reg)
                expect(availabilityTopic).toEqual(expect.not.stringContaining(" "));
                expect(availabilityTopic).toBe(`systemair/test/${expectedName}/availability`)
            });
        });
    });
    describe('config topic', () => {
        configRegisters.forEach(reg => {
            const expectedName = sanitizeTopicName(reg.name)
            test(`should generate correct topics for ${reg.name}`, () => {
                const configTopic = getConfigTopic("test", reg)
                expect(configTopic).toEqual(expect.not.stringContaining(" "));
                expect(configTopic).toBe(`homeassistant/${reg.type}/test/${expectedName}/config`)
            });
        });
    });
    describe('command topic', () => {
        selectRegisters.forEach(reg => {
            const expectedName = sanitizeTopicName(reg.name)
            test(`should generate correct topics for ${reg.name}`, () => {
                const selectTopic = getCommandTopic("test", reg)
                expect(selectTopic).toEqual(expect.not.stringContaining(" "));
                expect(selectTopic).toBe(`systemair/test/${expectedName}/set`)
            });
        });
    });
});
