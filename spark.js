/*eslint-env node */
/*eslint no-underscore-dangle:0, new-cap:0*/
"use strict";
var express = require("express");
var spark = require("spark");
var debug = require("debug")("spark");

function _login(t) {
  debug("[Login] Starting");
  var loginMethod = {};
  if(t.accessToken !== "") {
    loginMethod.accessToken = t.accessToken;
  } else if(t.username !== "" && t.password !== "") {
    loginMethod.username = t.username;
    loginMethod.password = t.password;
  } else {
    debug("[Login] No auth method supplied");
  }
  debug("[Login] Finishing");
  return spark.login(loginMethod).then(function(token) {
    t.accessToken = token;
    debug("[Login] Success");
    debug("[Login] Finishing");
  }, function(error) {
    debug("[Login] Error: %s", error);
  });
}

function getDevices_(t) {
  spark.listDevices().then(
    function(devices) {
      devices.forEach(function(device) {
        var keys = Object.keys(t.knownDevices);
        var match = false;
        for(var key in keys) {
          if(keys[key] === device.name) {
            match = true;
          }
        }
        // we know about the device
        if(match) {
          // it was connected before, is it still?
          if(t.knownDevices[device.name].connected) {
            // we only really care if it changest state
            if(!device.connected) {
              debug("[DeviceList] Device has gone offline %s", device.name);
              t.knownDevices[device.name] = device;
            }
          } else {
            // It wasn't connected before, did it come back online
            if(device.connected) {
              // it came back!
              debug("[DeviceList] Device has come back online %s", device.name);
              t.knownDevices[device.name] = device;
            }
          }
        } else {
          // We haven't seen the device before
          t.knownDevices[device.name] = device;
          // is it online or not?
          if(device.connected) {
            debug("[DeviceList] New online device %s", device.name);
          } else {
            debug("[DeviceList] New offline device %s", device.name);
          }
        }
        // find the devices role
        if(device.connected && Object.keys(t.deviceRoles).indexOf(device.name) === -1) {
          device.getVariable("role").then(function(data) {
            debug("[VariableGet] success: %s", data.result);
            t.deviceRoles[device.name] = data.result;
          }, function(err) {
            if(/variable not found/i.test(err.toString())) {
              t.deviceRoles[device.name] = "none";
            }
            debug("[VariableGet] failure: %s", err);
          });
        }
      });
    }, function(error) {
        debug("[DeviceList] Failure getting devices %s", error);
    }
  );
}

function isKnownDevice_(knownDevices, device) {
  var keys = Object.keys(knownDevices);
  return keys.indexOf(device) !== -1 ? true : false;
}

function callFunction_(device, command, args) {
  debug("Calling function: %s %s %s", "setConfig", command, args);
  return device.callFunction("setConfig", command + args, function(err, data) {
    if(err) {
      debug("error:", err);
      return err;
    } else {
      debug("Success");
      return data;
    }
  });
}

var Spark = function() {
  this.version = "0.1.0";
  this.accessToken = {};
  this.username = "";
  this.password = "";
  this.router = express.Router();
  this.knownDevices = [];
  this.deviceRoles = [];
  this.deviceInterval = "";
  this.deviceRefreshInterval = 10000;
  this.loadSuccess = false;
  this.load = function(options) {
    debug("[Load] Starting");
    if("sparkAccessToken" in options) {
      this.accessToken = options.sparkAccessToken;
      this.loadSuccess = true;
    } else if("sparkUsername" in options && "sparkPassword" in options) {
      this.username = options.sparkUsername;
      this.password = options.sparkPassword;
      this.loadSuccess = true;
    } else {
      debug("[Load] No login method provided");
    }
    debug("[Load] Finishing");
  };
  this.initilize = function() {
    debug("[Initilize] Starting");
    if(this.loadSuccess) {
      _login(this);
      getDevices_(this);
      this.deviceInterval = setInterval(getDevices_, this.deviceRefreshInterval, this);
    } else {
      debug("[Initilize] Cannot initilize, no login method specified");
    }
    debug("[Initilize] Finishing");
  };
  this.loadRoutes = function() {
    debug("[LoadRoutes] Starting");
    var self = this;
    this.router.get("/devices", function(req, res) {
      res.send(JSON.stringify(self.knownDevices));
    });
    this.router.get("/sendCommand", function(req, res) {
      res.send("ok");
    });
    this.router.get("/sendCommand/:device/:command/:args", function(req, res) {
      // for now I'm assuming that the command is verified on the sending end
      debug("[sendCommand] %s %s", req.params.device, req.params.command);
      var device = req.params.device;
      var command = req.params.command;
      var args = req.params.args || 0;
      //debug("device: %s command: %s args: %s",device, command, args);
      if(isKnownDevice_(self.knownDevices, device)) {
        debug("[sendCommand]", self.knownDevices[device].connected);
        callFunction_(self.knownDevices[device], command, args);
        res.send("ok");
      } else {
        res.send("unknown");
      }
    });
    this.router.get("/", function(req, res) {
      res.send("Spark!");
    });
    debug("[LoadRoutes] Finishing");
    return this.router;
  };
};


module.exports = Spark;
