# systemair-mqtt
utility to for polling systemtairs "hub" and publishing it to mqtt in a format home assistant understands. It polls the IAM every 60 seconds, and if it detects a change, it publishes that result to mqtt.

# Compability
Tested against a VTR-100 with the Internet access module (IAM). Might work against other models, or it might just break them.

I'm also running HA 2023.12 and Mosquitto MQTT broker.

# Status
This software is very much "use at your own risk" and is to be considered pre-alpha quality. I've added the registers I'm currently most interrested in. There's also no retry if updating a registry fails, which causes the entity in HA to show the invalid value until it can successfully poll the IAM module again.

The IAM module has issues doing quick successive queries and updates, which can cause problems if you're accessing the web ui of the IAM module at the same time as this application is running.

# Prerequisits
Node 18 with npm. Might work on other versions, but who knows.

To run it I would recommend using a public known

# How to
You'll need a mqtt broker, a user to the broker, and a running installation of home assistant. 

Check out the project, copy and rename the `systemair-config-example.js` file to `systemair-config.js` and fill in the blanks.

Then you can run it with:

`npm install && node systemair.js`

There is almost no error handling, so I'm currently running it with:

`while true; node systemair.js; sleep 10; end`

There's also a Dockerfile, to use this, a config dir must be mounted containing a file called `systemair-config.js`.
.
