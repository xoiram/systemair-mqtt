require('dotenv').config();

const {log} = require("./utils")
const {publishEntityStatus, publishUpdateIfChanged} = require("./systemair-mqtt-client")
const {selectRegisters, configRegisters, registers} = require("./systemair-registers")
const http = require("http");

const deviceHost = process.env.SYSTEMAIR_HOST || 'systemair-iam';

const readRegisters = (registers) => {
    log(`attempting to read ${registers.length}`)
    const encodedRegisters = `{${registers.map((reg) => `"${reg.register}":1`).join(",")}}`
    http.request({host: deviceHost, path: `/mread?${encodedRegisters}`}, (response) => {
        publishEntityStatus(registers, 'online');
        handleResponse(response, registers)
    }).on("error", (err) => {
        log(`received error reading registers: ${err}. exiting...`)
        publishEntityStatus(registers, 'offline')
        process.exit(1)
    }).end();

}

const updateDevice = (register, rawValue, registers) => {
    const relevantRegister = registers.find((p) => p.register === register.register)

    let factor = 1
    if (relevantRegister.decimals > 0) {
        factor = relevantRegister.decimals * 10
    }
    const value = rawValue * factor

    const encodedRequestParam = `{%22${register.register}%22:${value}}`
    log(`received request to update register ${register.register}`)
    http.request({host: deviceHost, path: `/mwrite?${encodedRequestParam}`}, (response) => {
        log(`[register: ${register.register}] updated. new value: ${value}`)
        publishUpdateIfChanged(register, value)
    })
        .on("error", (err) => {
            publishEntityStatus([relevantRegister], 'offline');
            log(`received error: ${err}`)
        })
        .end();
}

const updateRegisters = () => {
    readRegisters(registers)
    setTimeout(() => {
        readRegisters(configRegisters)
    }, 5000);
    setTimeout(() => {
        readRegisters(selectRegisters)
    }, 10000);
}

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

const handleResponse = function (response, registersToUse) {
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

            publishUpdateIfChanged(relevantReg, value)
        });
    });
};


module.exports = {
    updateRegisters,
    updateDevice,
}
