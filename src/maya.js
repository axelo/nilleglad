'use strict';
const Promise = require('bluebird');
const https = require('https');
const querystring = require('querystring');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

function login(username, password) {
    const form = {
        Username: username,
        Password: password
    };

    let loginCookie;

    return cookie()
        .then(cookie => {
            loginCookie = cookie;
            return postForm(cookie, '/maya/ASP/Login/loginAuthorizer.asp', form)
        })
        .then(result => {
            return loginCookie
        });
}

function logout(cookie) {
    return request({
        path: '/maya/asp/login/logout.asp',
        method: 'GET',
        headers: {
            'Cookie': cookie
        }
    })
    .then(result => {
        return 'success';
    });
}

function person(cookie) {
    return request({
        path: '/maya/ASP/Main/topRight.asp',
        method: 'GET',
        headers: {
            'Cookie': cookie
        }
    })
    .then(result => {
        return parsePerson(result.body);
    });
}

function timeReportingYearWeek(cookie, year, weekNo) {
    const form = {
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
    };

    return postForm(cookie, '/maya/ASP/PersonPlanning/TimeReportingAttestDayDate.asp', form)
        .then(result => parseRaaTimes(result.body));
}

function cookie() {
    return request({
        path: '/maya/ASP/Login/login.asp',
        method: 'HEAD'
    })
    .then(result => {
        const res = result.res;
        const cookie = (res.headers['set-cookie'] || '').toString().split('; ')[0];
        return cookie;
    });
}

function postForm(cookie, path, form) {
    const formData = querystring.stringify(form);

    return request({
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie
        }
    }, formData);
}

function request(options, data) {
    return new Promise(function(resolve, reject) {
        const reqOptions = requestOptions(options);

        if (data) {
            Object.assign(reqOptions.headers, {
                'Content-Length': Buffer.byteLength(data)
            });
        }

        const req = https.request(reqOptions, res => {
            if (res.statusCode !== 200) {
                return reject({ res });
            }
            
            const buffers = [];

            res.on('data', chunk => buffers.push(chunk));
            res.on('end', () => {
                const bodyBuffer = Buffer.concat(buffers);
                const body = iconv.decode(bodyBuffer, 'win1252');

                resolve({ res, body });
            });
        });

        req.on('error', err => {
            reject({ err });
        });

        if (data) req.write(data);

        req.end();
    });
}

function requestOptions(extraOptions) {
    const options = Object.assign({
        hostname: 'maya.decerno.se',
        port: 443,
        agent: false,
        encoding: null
    }, extraOptions);

    options.headers = Object.assign({
            'User-Agent': 'nilleglad',
            accept: '*/*'
    }, extraOptions.headers);

    return options;
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
        visby: visbyTime,
        total: distansTime + visbyTime
    };
}

function parsePerson(html) {
    const $ = cheerio.load(html);
    const link = $('a', 'table');
    const href = link.attr('href');

    if (!href) throw 'invalid html';

    const personIdStartIndex = href.indexOf('PersonID=');

    if (personIdStartIndex < 0) throw 'invalid html';

    const personId = parseInt(href.substring(personIdStartIndex + 'PersonID='.length));

    if (isNaN(personId)) throw 'invalid html';

    const names = link.text().split(', ');
    const firstName = names.length === 2 ? names[1] : names[0];
    const familyName = names.length === 2 ? names[0] : '';

    return {
        id: personId,
        firstName,
        familyName
    };
}

module.exports = {
    login,
    logout,
    person,
    timeReportingYearWeek
};
