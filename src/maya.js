'use strict';
const Promise = require('bluebird');
const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

function login(username, password) {
    const postData = querystring.stringify({
        Username: username,
        Password: password
    });

    let loginCookie;

    return cookie()
        .then(cookie => {
            loginCookie = cookie;
            return postFormData(cookie, '/maya/ASP/Login/loginAuthorizer.asp', postData)
        })
        .then(body => loginCookie);
}

function timeReportingYearWeek(cookie, year, weekNo) {
    const postData = querystring.stringify({
        startWeek: year + '-' + ((weekNo < 10 ? '0' : '') + weekNo),
        formMode: '',
        ProjectID: '',
        TaskRecordNo: '',
        RecordNo: '',
        weekNo: '',
        startDate: '',
        endDate: '',
        fromAttest: '',
        fromOrderNotReady: '',
        fromFakturaAttest: ''
    });

    return postFormData(cookie, '/maya/ASP/PersonPlanning/TimeReportingAttestDayDate.asp', postData)
        .then(body => parseRaaTimes(body));
}

function parseRaaTimes(html) {
    const $ = cheerio.load(html);

    const rows = $('tr:not(:first-child)', 'form[name="projActForm"] > table:first-child');
    const raaRows = rows.filter((i, tr) => $('a', tr).text().toLowerCase().startsWith('raä '));

    const raaVisbyRows = raaRows.filter((i, tr) => $('td', tr).text().toLowerCase().indexOf('visby') > -1);
    const raaDistansRows = raaRows.filter((i, tr) => $('td', tr).text().toLowerCase().indexOf('distans') > -1);

    const visbyTime = $('td[id^=activityProjTotal]', raaVisbyRows)
        .map((i, totTimeTd) => parseFloat($(totTimeTd).text())).get()
        .reduce((sum, time) => sum += time, 0);

    const distansTime = $('td[id^=activityProjTotal]', raaDistansRows)
        .map((i, totTimeTd) => parseFloat($(totTimeTd).text())).get()
        .reduce((sum, time) => sum += time, 0);

    return {
        distans: distansTime,
        visby: visbyTime
    };
}

function cookie() {
    return new Promise(function(resolve, reject) {
        https.request({
            hostname: 'maya.decerno.se',
            port: 443,
            path: '/maya/ASP/Login/login.asp',
            agent: false,
            headers: {
                'User-Agent': 'nilleglad',
                accept: '*/*'
            },
            method: 'HEAD'
        }, res => {
            if (res.statusCode !== 200) return reject(res.statusCode);

            const cookie = (res.headers['set-cookie'] || '').toString().split('; ')[0];
            resolve(cookie);
        }).on('error', err => {
            reject(err);
        }).end();
    });
}

function postFormData(cookie, path, formData) {
    return new Promise(function(resolve, reject) {
        const req = https.request({
            hostname: 'maya.decerno.se',
            port: 443,
            path: path,
            agent: false,
            headers: {
                'User-Agent': 'nilleglad',
                accept: '*/*',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookie,
                'Content-Length': Buffer.byteLength(formData)
            },
            method: 'POST',
            encoding: null
        }, res => {
            if (res.statusCode !== 200) return reject({ statusCode: res.statusCode, headers: res.headers });

            const buffers = [];

            res.on('data', chunk => buffers.push(chunk));
            res.on('end', () => {
                const bodyBuffer = Buffer.concat(buffers);
                const body = iconv.decode(bodyBuffer, 'win1252');

                resolve(body);
            });
        });

        req.on('error', err => reject(err));

        req.write(formData)
        req.end();
    });
}

module.exports = {
    login,
    timeReportingYearWeek
};
