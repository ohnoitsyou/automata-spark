var express = require('express');
var router = express.Router();
var spark = require('spark');
var util = require('util');

var Spark = function() {
  this.accessToken,
  this.username,
  this.password,
  this.knownDevices = [],
  this.deviceInterval,
  this.deviceRefreshInterval = 10000,
  this.load = function(options) {
    console.log('[Spark] [Load] Starting');
    if('sparkAccessToken' in options) {
      this.accessToken = options['sparkAccessToken'];
    } else if('sparkUsername' in options && 'sparkPassword' in options) {
      this.username = options['sparkUsername'];
      this.password = options['sparkPassword'];
    } else {
      console.log('[Spark] [Load] No access token provided');
    }
    console.log('[Spark] [Load] Finishing');
  },
  this.initilize = function() {
    console.log('[Spark] [Initilize] Starting');
    _login(this.accessToken);
    _getDevices(this);
    this.deviceInterval = setInterval(_getDevices,this.deviceRefreshInterval,this);
    console.log('[Spark] [Initilize] Finishing');
  }
}
function _login(token) {
  console.log('[Spark] [Login] Starting');
  return spark.login({'accessToken': token}).then(function(token) {
    this.accessToken = token;
    console.log('[Spark] [Login] Success:');//,token);
  }, function(error) {
    console.log('[Spark] [Login] Error:',error);
  });
  console.log('[Spark] [Login] Finishing');
}
function _getDevices(t) {
  spark.listDevices().then(
    function(devices) {
      devices.forEach(function(device) {
        var keys = Object.keys(t.knownDevices);
        var match = false;
        for(key in keys) {
          if(keys[key] == device.name) {
            match = true;
          } 
        }
        // we know about the device
        if(match) {
          // it was connected before, is it still?
          if(t.knownDevices[device.name].connected) {
            // we only really care if it changest state
            if(!device.connected) {
              console.log('[Spark] [DeviceList] Device gone offline',device.name);
            }
          } else {
            // It wasn't connected before, did it come back online
            if(device.connected) {
              // it came back!
              console.log('[Spark] [DeviceList] Device came back online',device.name);
            } 
          }
        } else {
          // We haven't seen the device before
          t.knownDevices[device.name] = device;
          // is it online or not?
          if(device.connected) {
            console.log('[Spark] [DeviceList] New online device',device.name);
          } else {
            console.log('[Spark] [DeviceList] New offline device',device.name);
          }
        }
      });
    }, function(error) {
        console.log('[Spark] [DeviceList] Failure getting devices',error);
    }
  );
}

module.exports = Spark;
