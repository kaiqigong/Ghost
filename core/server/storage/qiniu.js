// # Local File System Image Storage module
// The (default) module for storing images, using the local file system

var _       = require('lodash'),
    express = require('express'),
    util      = require('util'),
    fs      = require('fs-extra'),
    nodefn  = require('when/node/function'),
    path    = require('path'),
    Promise   = require('bluebird'),
    when    = require('when'),
    config = require('../config'),
    errors  = require('../errors'),
    baseStore   = require('./base'),
    crypto = require('crypto'),

    qiniu        = require('qiniu'),
    qiniuConfig  = config.qiniu;
    
    qiniu.conf.ACCESS_KEY = qiniuConfig.ACCESS_KEY;
    qiniu.conf.SECRET_KEY = qiniuConfig.SECRET_KEY;
    qiniu.conf.USER_AGENT = 'Ghost 0.4.2';

var putPolicy = new qiniu.rs.PutPolicy(qiniuConfig.bucketname),
    uptoken = putPolicy.token();

function QiniuFileStore() {
}
util.inherits(QiniuFileStore, baseStore);

// ### Save
// Saves the image to storage (the file system)
// - image is the express image object
// - returns a promise which ultimately returns the full url to the uploaded image
QiniuFileStore.prototype.save = function (image) {
    var md5sum = crypto.createHash('md5'),
        ext = path.extname(image.name),
        targetDirRoot = qiniuConfig.root,
        targetFilename,
        key,
        extra = new qiniu.io.PutExtra();

    var savedpath = path.join(config.paths.imagesPath, image.name);

    return Promise.promisify(fs.copy)(image.path, savedpath).then(function(){
        return Promise.promisify(fs.readFile)(savedpath);
    }).then(function(data){
        md5 = md5sum.update(data).digest('hex');

        targetFilename = path.join(targetDirRoot, md5.replace(/^(\w{1})(\w{2})(\w+)$/, '$1/$2/$3')) + ext;
        targetFilename = targetFilename.replace(/\\/g, '/');
        key = targetFilename.replace(/^\//, '');

        return Promise.promisify(qiniu.io.put)(uptoken, key, data, extra);
    }).then(function () {
        // prefix + targetFilename
        var fullUrl = qiniuConfig.prefix + targetFilename;
        return fullUrl;
    }).catch(function (e) {
        errors.logError(e);
        return Promise.reject(e);
    });
}

QiniuFileStore.prototype.exists = function (filename) {
    // fs.exists does not play nicely with nodefn because the callback doesn't have an error argument
    var done = when.defer();

    fs.exists(filename, function (exists) {
        done.resolve(exists);
    });

    return done.promise;
}

// middleware for serving the files
QiniuFileStore.prototype.serve = function () {
    var ONE_HOUR_MS = 60 * 60 * 1000,
        ONE_YEAR_MS = 365 * 24 * ONE_HOUR_MS;

    // For some reason send divides the max age number by 1000
    return express['static'](config.paths.imagesPath, {maxAge: ONE_YEAR_MS});
}


module.exports = QiniuFileStore;