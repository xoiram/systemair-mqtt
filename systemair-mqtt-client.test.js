const EventEmitter = require('events');

jest.mock('mqtt', () => ({connect: jest.fn()}));
jest.mock('./utils', () => ({log: jest.fn()}));

const deviceName = 'testdevice';

const createFakeClient = () => {
    const client = new EventEmitter();
    client.publish = jest.fn();
    client.subscribe = jest.fn((topic, cb) => cb(null));
    return client;
};

let client;
let log;
let updateDevice;
let configRegister;
let selectRegister;
let configTopic;
let selectTopic;

beforeEach(() => {
    jest.resetModules();
    process.env.SYSTEMAIR_DEVICE_NAME = deviceName;

    client = createFakeClient();
    require('mqtt').connect.mockReturnValue(client);
    log = require('./utils').log;
    updateDevice = jest.fn();

    // Load after resetModules so register objects match those the client uses
    const {configRegisters, selectRegisters, getCommandTopic} = require('./systemair-registers');
    configRegister = configRegisters[0];
    selectRegister = selectRegisters[0];
    configTopic = getCommandTopic(deviceName, configRegister);
    selectTopic = getCommandTopic(deviceName, selectRegister);

    require('./systemair-mqtt-client').initialize(updateDevice);
    client.emit('connect');
});

const logLines = () => log.mock.calls.map(([message]) => message);
const receive = (topic, message) => client.emit('message', topic, Buffer.from(message));

describe('MQTT message handling', () => {
    test('uses a single message listener', () => {
        expect(client.listenerCount('message')).toBe(1);
    });

    test('homeassistant/status online re-registers entities without an unknown-topic log', () => {
        client.publish.mockClear();
        log.mockClear();

        receive('homeassistant/status', 'online');

        expect(client.publish).toHaveBeenCalled();
        expect(logLines().filter(l => l.startsWith('received message on topic'))).toHaveLength(1);
        expect(logLines().some(l => l.includes('unknown topic'))).toBe(false);
        expect(updateDevice).not.toHaveBeenCalled();
    });

    test('homeassistant/status offline does not re-register entities', () => {
        client.publish.mockClear();

        receive('homeassistant/status', 'offline');

        expect(client.publish).not.toHaveBeenCalled();
    });

    test('config command updates the device once and logs once', () => {
        log.mockClear();

        receive(configTopic, '42');

        expect(updateDevice).toHaveBeenCalledTimes(1);
        expect(updateDevice).toHaveBeenCalledWith(configRegister, '42');
        expect(logLines().filter(l => l.startsWith('received message on topic'))).toHaveLength(1);
    });

    test('select command maps the option name to its value', () => {
        const option = selectRegister.options[1];

        receive(selectTopic, option.name);

        expect(updateDevice).toHaveBeenCalledTimes(1);
        expect(updateDevice).toHaveBeenCalledWith(selectRegister, option.value);
    });

    test('unknown topic is logged and ignored', () => {
        receive('some/other/topic', 'x');

        expect(updateDevice).not.toHaveBeenCalled();
        expect(logLines()).toContain('received message on unknown topic: some/other/topic');
    });

    test('reconnecting does not duplicate message handling', () => {
        client.emit('offline');
        client.emit('connect');

        receive(configTopic, '42');

        expect(client.listenerCount('message')).toBe(1);
        expect(updateDevice).toHaveBeenCalledTimes(1);
    });
});

describe('MQTT error handling', () => {
    let exitSpy;

    beforeEach(() => {
        exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        exitSpy.mockRestore();
    });

    test.each([4, 5, 134, 135])('exits on fatal CONNACK code %i', (code) => {
        client.emit('error', Object.assign(new Error('Connection refused'), {code}));

        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('keeps running on transient socket errors', () => {
        client.emit('error', Object.assign(new Error('connect ECONNREFUSED'), {code: 'ECONNREFUSED'}));

        expect(exitSpy).not.toHaveBeenCalled();
        expect(logLines().some(l => l.includes('will retry'))).toBe(true);
    });
});
