const systemairRegisters = require('./systemair-registers');
const {getConfigTopic, getCommandTopic} = require("./systemair-registers");

// Extract exported components
const {
    selectRegisters, configRegisters, registers, getStateTopic, getAvailabilityTopic,
} = systemairRegisters;

describe('Systemair MQTT Topic Generation', () => {
    describe('state topics', () => {
        registers.forEach(reg => {
            test(`should generate correct state topics for ${reg.name}`, () => {
                const entityValueTopic = getStateTopic("test", reg)
                expect(entityValueTopic).toBe(`homeassistant/systemair/test/${reg.register}/state`)
            })
            test(`should generate correct availability topics for ${reg.name}`, () => {
                const availabilityTopic = getAvailabilityTopic("test", reg)
                expect(availabilityTopic).toBe(`homeassistant/systemair/test/${reg.register}/availability`)
            });
        });
    });
    describe('config topic', () => {
        configRegisters.forEach(reg => {
            test(`should generate correct topics for ${reg.name}`, () => {
                const configTopic = getConfigTopic("test", reg)
                expect(configTopic).toBe(`homeassistant/systemair/test/${reg.register}/config`)
            });
        });
    });
    describe('command topic', () => {
        selectRegisters.forEach(reg => {
            test(`should generate correct topics for ${reg.name}`, () => {
                const selectTopic = getCommandTopic("test", reg)
                expect(selectTopic).toBe(`homeassistant/systemair/test/${reg.register}/set`)
            });
        });
    });
});
