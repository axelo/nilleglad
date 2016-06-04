var state = window.INITIAL_STATE || {
    report: {
        times: {},
        person: {}
    },
    pendingYearWeek: {},
    isFetching: false,
    isError: false
};

function update(action) {
    var nextState;

    if (action.type === 'FETCHED') {
        nextState = Object.assign({}, state, {
            report: action.payload,
            isFetching: false,
            isError: false
        });
    }
    else if (action.type === 'FETCHING') {
        nextState = Object.assign({}, state, {
            pendingYearWeek: action.payload,
            report: Object.assign({}, state.report, {
                year: action.payload.year,
                week: action.payload.week,
                times: {
                    visby: 0,
                    distans: 0,
                    total: 0
                }
            }),
            isFetching: true, 
            isError: false 
        });
    }
    else if (action.type === 'FETCHED_FAILED') {
        nextState = Object.assign({}, state, {
            isFetching: false,
            isError: true
        });
    }

    state = nextState;

    render(state);
}

function render(state) {
    if (state.isFetching) {
        document.getElementById('fetched-report').style.visibility = 'hidden';
        document.getElementById('fetch-failed').style.display = 'none';
        document.getElementById('fetching-report').style.display = 'block';

        window.history.replaceState({} , 'nilleglad', state.pendingYearWeek.year + '-' + state.pendingYearWeek.week);
    }
    else if (state.isError) {
        document.getElementById('fetched-report').style.visibility = 'hidden';
        document.getElementById('fetching-report').style.display = 'none';
        document.getElementById('fetch-failed').style.display = 'block';
    }
    else {
        document.getElementById('fetched-report').style.visibility = 'visible'; 
        document.getElementById('fetch-failed').style.display = 'none';
        document.getElementById('fetching-report').style.display = 'none';
    }

    document.getElementById('times-visby').textContent = state.report.times.visby;
    document.getElementById('times-distans').textContent = state.report.times.distans
    document.getElementById('times-total').textContent = state.report.times.total
    document.getElementById('person-first-name').textContent = state.report.person.firstName;
    document.getElementById('person-family-name').textContent = state.report.person.familyName;

    document.getElementById('mailto').href = 'mailto:' + state.mailTo + '?subject=' + mailSubject(state.report) + '&body=' + mailBody(state.report);
}

function mailSubject(report) {
    return 'Tidrapport för v.' + report.week;
}

function mailBody(report) {
    var br = '%0D%0A';

    return 'Hej, ' + br +
        br +
        'Tidrapport för v.' + report.week + br +
        br +
        'Visby: ' + report.times.visby + 'h' + br +
        'Stockholm: ' + report.times.distans + 'h' + br +
        br +
        'Totalt: ' + report.times.total + 'h' + br +
        br +
        'Mvh' + br +
        report.person.firstName + ' ' + report.person.familyName;
}

function doFetchReport() {
    var year = parseInt(document.getElementById('year').value, 10);
    var week = parseInt(document.getElementById('week').value, 10);

    if (!year || !week || year < 1000 || week < 0 || week > 99) return;

    update({ type: 'FETCHING', payload: { year: year, week: week } });

    var httpRequest = new XMLHttpRequest();

    httpRequest.open('GET', 'api/' + year + '-' + week, true);
    httpRequest.send(null);

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState === XMLHttpRequest.DONE) {
            if (state.pendingYearWeek.year !== year || state.pendingYearWeek.week !== week) return;

            if (httpRequest.status === 200) {

                try {
                    return update({ type: 'FETCHED', payload: JSON.parse(httpRequest.responseText) });
                } catch (e) {
                    return update({ type: 'FETCHED_FAILED' });
                }
            }

            return update({ type: 'FETCHED_FAILED' });
        }
    }
}

function doCopyToClipboard() {
    copyToClipboard(mailBody(state.report).replace(/%0D%0A/g, '\n'));
}

function copyToClipboard(text) {
    var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (iOS) return alert('Stöds inte på iOS ännu');

    var copyElement = document.createElement('textarea');
    copyElement.value = text;
    copyElement = document.body.appendChild(copyElement);
    copyElement.select();
    document.execCommand('copy');
    copyElement.remove();
}

render(state);
