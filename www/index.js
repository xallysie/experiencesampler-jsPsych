/* 
    @ EXPERIENCESAMPLER LICENSE @
    http://www.experiencesampler.com/
    Copyright (c) 2014-2020 Sabrina Thai & Elizabeth Page-Gould

    @ JSPSYCH EXPERIENCESAMPLING PLUGIN LICENSE @
    Experience-sampling extension for jsPsych adapted from ExperienceSampler
    last updated 2023/07/19 - https://github.io/xallysie/cordova-jsPsych-experiencesampling-plugin 
    Copyright (c) 2023 Sally Xie

    The MIT License (MIT)

        Permission is hereby granted, free of charge, to any person obtaining a copy
        of this software and associated documentation files (the "Software"), to deal
        in the Software without restriction, including without limitation the rights
        to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
        copies of the Software, and to permit persons to whom the Software is
        furnished to do so, subject to the following conditions:
        The above copyright notice and this permission notice shall be included in all
        copies or substantial portions of the Software.
        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
        OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
        SOFTWARE.
*/

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
function onLoad() {
    document.addEventListener("deviceready", onDeviceReady, false);
    console.log("App is loaded.")
}
function onDeviceReady() {
    document.addEventListener("pause", onPause, false);
    document.addEventListener("resume", onResume, false);
    document.addEventListener("menubutton", onMenuKeyDown, false);
    console.log("Device is ready.")
    // Add similar listeners for other events
}
function onPause() {
    // Handle the pause event
}
function onResume() {
    // Handle the resume event
    console.log("App resumed! Welcome back.");
    app.reinitjsPsych();
    app.initCurrent();
    appReady.checkAccess();
    console.log("Surveys reinitiated.")
}
function onMenuKeyDown() {
    // Handle the menubutton event
}

/* initialize app localStorage */
var localStore = window.localStorage;

/* initialize notification permission request (for Android API 33+) */
var permissions = cordova.plugins.permissions;

/* initialize firebase storage (primary data storage method) */
//**CHANGEME */
var firebaseConfig = {
    databaseURL: "socialselves.firebaseapp.com",
    apiKey: "AIzaSyAeZCaC7d5y0xqwQ_2iI2kBOND9yAKEKf4",
    authDomain: "socialselves.firebaseapp.com",
    projectId: "socialselves",
    storageBucket: "socialselves.appspot.com",
    messagingSenderId: "279784529433",
    appId: "1:279784529433:web:9fcfd4f03389fa259bd488",
    measurementId: "G-1KT23F2PRK" // For Firebase JS SDK v7.20.0 and later, measurementId is optional
};
firebase.initializeApp(firebaseConfig);
firebase.firestore().settings({ experimentalAutoDetectLongPolling: true, merge:true }); // for ios
var db = firebase.firestore();

/* initialize jsPsych */
var jsPsych = initJsPsych({
    default_iti: 100,
    show_progress_bar: true,
    message_progress_bar: '',
    /* uncomment to use div styles*/
    //display_element: 'display_stage',

    // study finish function
    //**CHANGEME */
    on_finish: function () {     
        /* show survey completion message with prolific link */
        var jspsych_content = document.getElementById("jspsych-content");
        jspsych_content.innerHTML = 'Done! Please close the app completely (swipe the app up).'
    }
});

/* initialize dataPipe (secondary data storage method) */
const survey_id = jsPsych.randomization.randomID(10); // generate unique id
const filename = `${survey_id}.csv`; // generate unique filename

/* create timeline */
var timeline = [];

/* declare global variables */ 
// declare all the global vars you need jsPsych to access here
var surveyID = survey_id; // unique survey id generated each time participant accesses a survey
var ParGen_FM, ParGen_MF; // participant binary gender identification
var ParGenPlural, ParGenPossessive, ParGenSingular, ParGenPronoun; // participant binary gender pronouns to be used in surveys
var ParGen_NB; // participant non-binary gender identification
var pID, pID_1, pID_2, pID_3; // participant anonymous survey-matcher ID
var surveyCount, expectedSurveyCount, surveyCountMax; // track how many surveys are completed
var restart_trigger, notifTestSuccess, snoozed, settingup, surveytime, now, deviceOS; // variables for setting up the app
var cond_AloneWithOther; // variables for conditional timelines
var samplingperiod = 21; // declare how many days data collection will run for (e.g., 21 days) //**CHANGEME */
var surveysPerDay = 2; // how many surveys to send out per day //**CHANGEME */
var surveyCountMax = 42; // total number of surveys to send //**CHANGEME */
var surveyblockhour = 3; // declare how long each survey block should be, in hours (for scheduling notifications) //**CHANGEME */
var savedata_success; // variables for checking whether data successfully sent
var notifs = []; // array to store notifications; will check this to see if participants should have survey access
var surveyWindow = 10800000; // survey window in milliseconds (3 hours); determines how long participants have survey access for //**TESTING change back to 10800000 */
var Date_start_time = new Date().toLocaleString('en-US');


/* add participant-level data to all trials */
jsPsych.data.addProperties({
    pID: localStore.pID,
    surveyID: surveyID,
    surveyCount: surveyCount,
    Date_Start_Time: Date_start_time,
});

//** app object for storing functions */
var app = {
    // function to randomly select survey notification time within a survey window
    selectSurveyTime: function(min, max){
        // randomly select a time between the start and end time of the survey block 
        return Math.floor(Math.random()*(max-min + 1) + min)
    },
    // function to schedule notifications
    scheduleNotifs:function() { 
        //**CHANGEME */
        //**declare vars */    
        // declare how many surveys to send out per day (e.g., if you want to beep participants 6 times a day, declare 6 intervals)
        var interval1, interval2;
    
        // declare variable(s) to represent the id of each notification for the day
        // declare as many letters as you have intervals (e.g., 6 intervals, declare 6 ids)
        var a, b;
    
        // declare a variable to represent new date to be calculated for each beep (e.g., if there are 6 intervals, declare 6 new dates)
        var date1, date2;
    
        // declare the start and end time of the daily survey/notification block (i.e., block of time when participants will receive notifs)
        var survey1Start, survey1End, survey2Start, survey2End;
        
        // set the participant's survey blocks based on their responses from the setup questions
        survey1Start = localStore.survey1Start.split(":");
        //survey1End = localStore.survey1End.split(":"); // uncomment this if you want participants to choose their own block end times; in this study, the end time is auto set to 3 hours after the start time
        survey2Start = localStore.survey2Start.split(":");
        //survey2End = localStore.survey2End.split(":"); // uncomment this if you want participants to choose their own block end times; in this study, the end time is auto set to 3 hours after the start time
            
        // declare any values that you might use more than once such as the number of milliseconds in a day
        var dayms = 86400000;
    
        // declare variables that will represent the survey start and end times for each interval
        // (e.g., if you have 6 intervals, declare 12 variables: 6 start times and 6 end times)
        var time1 = new Date();
        var time2 = new Date(); 
        var time3 = new Date();
        var time4 = new Date(); 
        
        // declare variables that will represent the survey start and end *dates* (not times) for each interval
        // HIGHLY RECOMMEND adding +1 to each line, which will add 1 day to each of these new date objects so the surveys begin the next day
        // e.g., time1.getDate() + parseInt(1);
        // this allows the nightly compliance checker to function properly; changing this will mess with compliance checker unless you modify that
        var day1 = time1.getDate() + 1; //**TESTING: to test app, remove the parseInt(1) so the notifs fire same day */
        console.log("day1: "+day1);
        var day2 = time2.getDate() + 1;
        var day3 = time3.getDate() + 1;
        var day4 = time4.getDate() + 1;
    
        // now set the survey start and end times based on participants' responses from the setup questions
        // this block of code does not allow participants to select their own survey 'end time'; it is set to 3 hours (surveyblockhour)
        // after the survey start time of each block
        var survey1StartTime = time1.setDate(day1); 
        survey1StartTime = time1.setHours(parseInt(survey1Start[0]), parseInt(survey1Start[1]), 0, 0); 
        var survey1EndTime = time2.setDate(day2); 
        survey1EndTime = time2.setHours((parseInt(survey1Start[0])+parseInt(surveyblockhour)), parseInt(survey1Start[1]), 0, 0);
        
        //**TESTING THE APP */
        // uncomment below to test notifs quickly (3 min window)
        // surveyWindow = 120000; // when testing, we limit this to only 2 minutes (in milliseconds)
        // survey1EndTime = time2.setHours(parseInt(survey1Start[0]), (parseInt(survey1Start[1])+parseInt(surveyblockhour)), 0, 0);

        // uncomment below if you want participants to set their own end times for each block
        // survey1EndTime = time2.setHours(parseInt(survey1End[0]), parseInt(survey1End[1]), 0, 0);
        
        var survey2StartTime = time3.setDate(day3); 
        survey2StartTime = time3.setHours(parseInt(survey2Start[0]), (parseInt(survey2Start[1])+parseInt(3)), 0, 0); 
        var survey2EndTime = time4.setDate(day4); 
        survey2EndTime = time4.setHours((parseInt(survey2Start[0])+parseInt(surveyblockhour)), parseInt(survey2Start[1]), 0, 0);

        //**TESTING THE APP */
        // uncomment below to test notifs quickly (3 min window)
        // survey2StartTime = time3.setHours((parseInt(survey2Start[0])-parseInt(surveyblockhour)), (parseInt(survey2Start[1])+parseInt(3)), 0, 0); 
        // survey2EndTime = time4.setHours((parseInt(survey2Start[0])-parseInt(surveyblockhour)), (parseInt(survey2Start[1])+parseInt(3)+parseInt(surveyblockhour)), 0, 0);

        // uncomment below if you want participants to set their own end times for each block
        // survey2EndTime = time4.setHours(parseInt(survey2End[0]), parseInt(survey2End[1]), 0, 0);
    
        // set notifications
        for (i = 0; i < samplingperiod; i++) { // loop to schedule notifs for the days in your data collection period
            var survey1Min  = survey1StartTime + dayms*i; 
            var survey1Max  = survey1EndTime + dayms*i; 
    
            var survey2Min  = survey2StartTime + dayms*i; 
            var survey2Max  = survey2EndTime + dayms*i; 
    
            // randomly select survey time within each interval or block
            // (e.g., if an interval is between 4-7pm, then for each notification, randomly select a time within this block to send notif)
            interval1 = app.selectSurveyTime(survey1Min, survey1Max); 
            interval2 = app.selectSurveyTime(survey2Min, survey2Max); 
    
            // set a unique id number for each notification (do this for however many intervals you have)
            a = 101+(parseInt(i)*100);
            b = 102+(parseInt(i)*100);
            
            // compute the time when the notification should be sent by adding the time interval to the current date and time        
            date1 = new Date(interval1); 
            date2 = new Date(interval2);
            epoch1 = date1.getTime();
            epoch2 = date2.getTime();
    
            // schedule notifications using cordova local notifications plugin 
            cordova.plugins.notification.local.schedule([
                {id: a, trigger: {at: new Date(epoch1)}, text: 'Time for your first survey for the day! You have 2 hours to do it!', title: 'Daily Study about the Self', priority:2, vibrate:true},
                {id: b, trigger: {at: new Date(epoch2)}, text: "Time for your second survey for the day! You have 2 hours to do it!", title: 'Daily Study about the Self', priority:2, vibrate:true},
            ]);
    
            //This part of the code records when the notifications are scheduled for and sends it to the server
            localStore['notification_' + i + '_1'] = localStore.pID + "_" + a + "_" + date1;
            localStore['notification_' + i + '_2'] = localStore.pID + "_" + b + "_" + date2;
            
            notifs.push(interval1, interval2);
        }
        surveyStart = parseInt(notifs[0]); 
        surveyEnd = (parseInt(notifs[41]) + parseInt(surveyWindow)); 
        localStore.surveyStart = surveyStart; 
        localStore.surveyEnd = surveyEnd;
        localStore.notifs = notifs; 
    },
    // check whether participants are completing the expected number of surveys; if not, schedule a reminder that they've missed X
    complianceNotif:function(){
        // get current survey count and timestamp for the first notification that was sent
        surveyCount = parseInt(localStore.getItem('surveyCount')) || 0; 
        surveyStart = localStore.surveyStart; 
        
        // extract just the date, then set the time of the extracted date to 12:00 AM
        var surveyStartDate = surveyStart.split("T")[0];
        surveyStartDate = new Date(surveyStartDate + "T00:00:01Z");

        var now = new Date(); // get current date and time

        // Calculate the difference in days between the current date and surveyStartDate
        var daysElapsed = surveyStartDate.getTime() - now.getTime(); // calculate difference in epoch time
        daysElapsed = Math.floor(daysElapsed / (1000 * 60 * 60 * 24)); // convert epoch time to days that have elapsed
        
        // Set the expectedSurveyCount based on the number of surveys per day (e.g., 2 surveys per day)
        expectedSurveyCount = surveysPerDay * daysElapsed;
        
        // track how many missing surveys
        var missingSurveyCount = expectedSurveyCount - surveyCount;

        // declare a var to track whether participants have missed additional surveys since the last reminder
        var missedAnotherSurvey = parseInt(localStore.getItem('missedAnotherSurvey')) || 0; // set to 0 if this var is null
        
        // Check if the participant has missed any additional surveys since last reminder (or missed for the first time)
        if (missingSurveyCount > missedAnotherSurvey){
            // schedule a reminder notification for this evening (at 11:59 PM)
            var eveningNotifTime = new Date();
            eveningNotifTime.setHours(23,59,0,0);

            // notification text will be different depending on how many surveys were missed
            //**CHANGEME */
            if (missingSurveyCount < 4){
                cordova.plugins.notification.local.schedule({
                    id: 99401, // Unique ID for the missed surveys notification
                    trigger: { at: eveningNotifTime },
                    text: "You have missed a survey yesterday. Please respond to your notifications on time, to remain eligible for the end-of-study bonus.",
                    title: "Missed Survey Reminder",
                    priority: 2,
                    vibrate: true,
                });
            } else if (missingSurveyCount >= 4 && missingSurveyCount <= 7){
                cordova.plugins.notification.local.schedule({
                    id: 99402, // Unique ID for the missed surveys notification
                    trigger: { at: eveningNotifTime },
                    text: "You have missed a survey yesterday. To be eligible for the end-of-study bonus, please do not miss more than 7 surveys total.",
                    title: "Missed Survey Reminder",
                    priority: 2,
                    vibrate: true,
                });
            } else if (missingSurveyCount > 7){
                cordova.plugins.notification.local.schedule({
                    id: 99403, // Unique ID for the missed surveys notification
                    trigger: { at: eveningNotifTime },
                    text: "You have missed a survey yesterday. Please remember to respond to your notifications on time.",
                    title: "Missed Survey Reminder",
                    priority: 2,
                    vibrate: true,
                });
            }

            // update the missedAnotherSurvey counter in local storage
            localStore.missedAnotherSurvey = missingSurveyCount;
            localStore.missingSurveyCount = missingSurveyCount;
        };
    },

    // increase survey counter by 1 and save to local storage
    increaseSurveyCount:function(){
        surveyCount = parseInt(localStore.getItem('surveyCount')) || 0;
		surveyCount++;
		localStore.setItem('surveyCount', surveyCount.toString());   
        console.log("Survey Count increased by 1");
    },

    // function to record global variables at the end of a survey
    addGlobalVars:function(){
        /* record time that participant finished survey */
        var Date_end_time = new Date().toLocaleString('en-US');
        var pID = localStore.pID;
        snoozed = 0;
        var surveyCount = localStore.surveyCount;
        var surveyStart = localStore.surveyStart;
        var surveyEnd = localStore.surveyEnd;
        var snoozed = snoozed;
        var ParGen_FM = localStore.ParGen_FM;
        var ParGen_MF = localStore.ParGen_MF;
        var ParGen_NB = localStore.ParGen_NB;
        /* add global variables to participant data */
        jsPsych.data.addProperties({
            ParGen_FM: ParGen_FM,
            ParGen_MF: ParGen_MF, 
            ParGen_NB: ParGen_NB,
            pID: pID,
            surveyCount: surveyCount,
            studyStart: surveyStart,
            studyEnd: surveyEnd,
            Date_End_Time: Date_end_time,
            snoozed: snoozed,
        });
        console.log("Global vars recorded")
    },

    // function to write data to firebase storage
    saveDataFirebase:function(){
        /* write data to firebase */
        // var trialdata = jsPsych.data.get().csv();
        var trialdata = jsPsych.data.get().json(pretty=true);
        var trialdata_save = JSON.parse(trialdata);
        var trialdata_saveObj = {};
        for (var i = 0; i < trialdata_save.length; i++) {
            trialdata_saveObj[i] = trialdata_save[i];
        }
        //**CHANGEME */
        // declare the name of the collection/folder on firebase storage to store data from current survey
        // the code below saves to different collections depending on whether participants snoozed/setup the app or completed a survey
        var firebaseFolder = snoozed || settingup ? "expsampling_jsPsych_FULL_setuporsnooze" : "expsampling_jsPsych_FULL_responses";

        // save data (FEATURE TO ADD IN THE FUTURE: wrap in a promise to check if data successfully sent)
        db.collection(firebaseFolder).add(trialdata_saveObj);
    },
    // schedule a snoozed notification
    //Replace X with the number of seconds you want the app to snooze for (e.g., 10 minutes is 600 seconds)
    snoozeNotif:function() {
        var now = new Date().getTime(), snoozeDate = new Date(now + 600*1000); 
        var id = '99';
        cordova.plugins.notification.local.schedule({
                                             id: id,
                                             title: 'Daily Study About the Self',
                                             text: 'Are you able to take the survey now?',
                                             at: snoozeDate,
                                             });
    },
    // validate time
    //**CHANGEME**//
    invalidTime1: function(data){ //check to whether participants entered an invalid time for the first survey block/interval
        var time = data.values()[0].response;
        if (time=== ""){
            return true	
        } else if ( // don't allow participants to pick a time X hours before midnight (controlled by 'surveyblockhour' var)
            time.split(":")[0] >= (parseInt(24)-parseInt(surveyblockhour))
            ){ 
            return true
        }
        else { // if participants entered a valid time, the 
            var survey1timevalidate = time.split(":");
            localStore.survey1timevalidate = survey1timevalidate; 
            return false
        }
    },
    invalidTime2: function(data){ // returns false only if the second time block is at least X hours after the first; set this with surveyblockhour var
        //**CHANGEME**//
        var time = data.values()[0].response;
        var hour = time.split(":")[0]; 
        var minute = time.split(":")[1]; 
        var survey1timevalidate = localStore.survey1timevalidate;
        var survey1timevalidate = survey1timevalidate.split(",");
        if(time=== ""){ // if participants did not pick a time, throw error
            return true
        } else if (parseInt(hour) < (parseInt(survey1timevalidate[0])+parseInt(surveyblockhour))){ // if time2 is less than X hours after time1, throw error
            return true
        } else if (parseInt(hour) === (parseInt(survey1timevalidate[0]) + parseInt(surveyblockhour)) && 
            parseInt(minute) < parseInt(survey1timevalidate[1])){ //if time2 is less than X hours after time1, throw error
            return true
        } else {
            return false
        }
    },
    convertEpochTime: function(epoch) {
        const somedate = new Date(epoch);
        const formattedDateTime = somedate.toLocaleString("en-US", {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        return formattedDateTime;
    },
    parGenPronouns: function(){
        // create and store gendered pronouns
        if (ParGen_FM == 0) {
            ParGenPlural = "women";
            ParGenSingular = "woman";
            ParGenPronoun = "she";
            ParGenPossessive = "her";
        } else if (ParGen_FM == 1) {
            ParGenPlural = "men";
            ParGenSingular = "man";
            ParGenPronoun = "he";
            ParGenPossessive = "his";
        }
        localStore.ParGenPlural = ParGenPlural;
        localStore.ParGenSingular = ParGenSingular;
        localStore.ParGenPronoun = ParGenPronoun;
        localStore.ParGenPossessive = ParGenPossessive;
    },
    initCurrent:function(){
        // initialize survey counters and date objects to check if survey is currently available
        console.trace();
        now = new Date().getTime(); //current time
        console.log("Survey initiated. Current time is "+now);

        // if this is the first time running the app
        if(localStore.pID === " " || localStore.pID === "" || !localStore.pID || localStore.pID == "undefined"){
            // store survey count. defaults to 0 if value does not exist or cannot be parsed as a number
            //surveyCount = parseInt(localStore.getItem('surveyCount')) || 0;
            surveyCount = localStore.surveyCount || 0;

            // localStorage can only store strings. convert this to a string
            localStore.surveyCount = surveyCount;
            //localStore.setItem('surveyCount', surveyCount.toString()); 
            
            settingup = true; // used to indicate that data from this survey will be saved to setup collection
        } else {
            surveyCount = parseInt(localStore.getItem('surveyCount'));
            surveyCount = localStore.surveyCount;
            ParGen_FM = localStore.ParGen_FM;
            ParGen_MF = localStore.ParGen_MF;
            ParGenPlural = localStore.ParGenPlural;
            ParGenSingular = localStore.ParGenSingular;
            ParGenPossessive = localStore.ParGenPossessive;
            ParGenPronoun = localStore.ParGenPronoun;     
            app.complianceNotif();          
        }
    },
    reinitjsPsych:function(){
        // reinitialize jsPsych when resuming the app
        console.log("jsPsych reinitiated")
        var jsPsych = initJsPsych({
            default_iti: 100,
            show_progress_bar: true,
            message_progress_bar: '',
            /* uncomment to use div styles*/
            //display_element: 'display_stage',
        
            // study finish function
            //**CHANGEME */
            on_finish: function () {     
                /* show survey completion message with prolific link */
                var jspsych_content = document.getElementById("jspsych-content");
                jspsych_content.innerHTML = 'Done! Please close the app completely (swipe the app up).'
            }
        });
        
        /* create timeline */
        timeline = [];

        /* add participant-level data to all trials */
        jsPsych.data.addProperties({
            pID: localStore.pID,
            surveyID: surveyID,
            surveyCount: surveyCount,
            Date_Start_Time: Date_start_time,
        });
    },
};

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
/* Program jsPsych Experiment Questions */
// these questions will be presented to participants at different stages of participation
// (e.g., setup, experience-sampling, end-of-survey messages)
//**CHANGEME */
var appReady = {
    /* Program your app setup questions here */
    loadSetup: function(){
        // setup questions will run if this function is called
        settingup = true; 
        surveytime = false;
        /*0*/
        var Setup_0_Welcome = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "<img src='img/icon_alt.png' width=50px; height=50px;><br><b>Daily Studies About the Self</b><p style='font-weight: normal;'>Thank you for participating in our 3-week study.</p>Please click the button below to begin setup.",
            choices: ['NEXT'],
            data: {WhatWasRating:'INSTRUCTIONS'},
            css_classes: ['instructions'],
        };
        /*1*/
        var Setup_1_ID1 = {
            type: jsPsychSurveyHtmlForm,
            html: '<br><input name="pID_1" type="text" id="responsebox" maxlength="3" autocapitalize="characters"/><br><br>',
            autofocus: 'responsebox',
            preamble: "<b>Survey Matcher: Enter your anonymous participant ID below.</b><br><br>This section allows us to match your responses with other data you provide us, while still making sure your data remain completely anonymous and confidential. <br/><br/>Please write the <b>first three letters</b> of the first street you ever lived on (e.g., the first street I lived on was Essex Street, so I would enter 'ESS'):",
            data: {WhatWasRating:'Setup_pID_1'},
            css_classes: ['setup'],
            required: true,
            on_finish: function(){
                /* flatten response into a string array and then concat/join into one string */
                jsPsych.data.getLastTrialData().values()[0].response = Object.values(jsPsych.data.getLastTrialData().values()[0].response).flat().join();
                pID_1 = jsPsych.data.getLastTrialData().values()[0].response;
                pID = String(pID_1);
            }
        };
        /*2*/
        var Setup_2_ID2 = {
            type: jsPsychSurveyHtmlForm,
            html: '<br><input name="pID_2" type="tel" id="responsebox" maxlength="2"/><br><br>',
            autofocus: 'responsebox',
            preamble: "<b>Survey Matcher: Enter your anonymous participant ID below.</b><br><br> This section allows us to match you with other data you provide us, while still making sure your data remain completely anonymous and confidential. <br/><br/>Please enter the <b>2-digit</b> calendar day of your birthday (e.g., I was born on December 1st, so I would enter '01'):",
            data: {WhatWasRating:'Setup_pID_2'},
            css_classes: ['setup'],
            required: true,
            on_finish: function(){
                /* flatten response into a string array and then concat/join into one string */
                jsPsych.data.getLastTrialData().values()[0].response = Object.values(jsPsych.data.getLastTrialData().values()[0].response).flat().join();
                pID_2 = jsPsych.data.getLastTrialData().values()[0].response;
                pID += String(pID_2);
            }
        };
        /*3*/
        var Setup_3_ID3 = {
            type: jsPsychSurveyHtmlForm,
            html: '<br><input name="pID_3" type="text" id="responsebox" maxlength="2" autocapitalize="characters"/><br><br>',
            autofocus: 'responsebox',
            preamble: "<b>Survey Matcher: Enter your anonymous participant ID below.</b><br><br> This section allows us to match you with other data you provide us, while still making sure your data remain completely anonymous and confidential. <br/><br/>Please enter the <b>last two letters</b> of your mother's maiden name (e.g., My mother's maiden name is Campbell, so I would enter 'LL'):",
            data: {WhatWasRating:'Setup_pID_3'},
            css_classes: ['setup'],
            required: true,
            on_finish: function(){
                /* flatten response into a string array and then concat/join into one string */
                jsPsych.data.getLastTrialData().values()[0].response = Object.values(jsPsych.data.getLastTrialData().values()[0].response).flat().join();
                pID_3 = jsPsych.data.getLastTrialData().values()[0].response;
                pID += String(pID_3);
                localStore.pID = pID;
                console.log(pID);
                console.log(localStore.pID);
            }
        };
        /*4*/
        var Setup_4_ID_Validation = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                if(localStore.pID === " " || !localStore.pID || localStore.pID == "undefined" || pID_1 === "" || !pID_1 || pID_1 == "undefined" || pID_2 === "" || !pID_2 || pID_2 == "undefined" || pID_3 === "" || !pID_3 || pID_3 == "undefined"){
                    var text = "<img src='img/oops.png' width='50px'; height='50px';><br>Oops! The Survey Matcher ID you entered does not seem to be valid.<br><br>Please return to re-enter your anonymous participant ID to continue with setup.";
                    restart_trigger = true;
                    return text;
                } else {
                    var text = "Your ID is <br/><br/><b> PARTICIPANTID </b> <br/><br/>If this is correct, please continue."
                    text = text.replace("PARTICIPANTID", function replacer() {return pID;}); //dynamically replace participant ID
                    restart_trigger = false;
                    return text;
                }
            },
            choices: ['NEXT','GO BACK'],
            data: {WhatWasRating:'Setup_pID_Validate'},
            css_classes: ['instructions'],
            post_trial_gap: 100,
            on_finish: function(){
                /* restart setup or continue depending on selection */
                if(jsPsych.data.getLastTrialData().values()[0].response == 1 || restart_trigger == true || (localStore.pID === " " || !localStore.pID || localStore.pID == "undefined")){
                    localStore.clear(); // clear local storage and cache 
                    jsPsych.endCurrentTimeline() // end timeline
                    jsPsych.endExperiment("Clearing local storage...") // end experiment
                    pID = ' ';
                    jsPsych.run(timeline);
                    console.log("CLEARED");
                }
            }
        };
        /*5*/
        var Setup_5_ParGen_MF = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Do you describe yourself as a man, a woman, or in some other way?",
            choices: ['Man','Woman','Some other way'],
            data: {WhatWasRating:'Setup_ParGen_MF'},
            css_classes: ['trial'],
            on_finish: function(){
                /* record response or ask second gender identification question */
                if(jsPsych.data.getLastTrialData().values()[0].response < 2){
                    ParGen_MF = jsPsych.data.getLastTrialData().values()[0].response;
                    ParGen_FM = parseInt(1) - parseInt(ParGen_MF);
                    ParGen_NB = 0;
                    localStore.ParGen_MF = ParGen_MF;
                    localStore.ParGen_FM = ParGen_FM;
                    localStore.ParGen_NB = ParGen_NB;
                    app.parGenPronouns();
                } else {
                    ParGen_MF = 2;
                    ParGen_NB = 1;
                    localStore.ParGen_NB = ParGen_NB;
                }
            }
        };
        /*6*/ 
        // only display this if participants identify as gender non-binary
        var Setup_6_If_ParGen_MF_2 = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "The rest of the survey will have questions asking about your impressions of men or women and how you personally relate to ideas of manhood and womanhood. Which version of the survey would you prefer to see?",
            choices: ['Man','Woman'],
            data: {WhatWasRating:'Setup_ParGen_MF_2'},
            css_classes: ['trial'],
            on_finish: function(){
                /* record response */
                ParGen_MF = jsPsych.data.getLastTrialData().values()[0].response;
                ParGen_FM = parseInt(1) - parseInt(ParGen_MF);
                localStore.ParGen_MF = ParGen_MF;
                localStore.ParGen_FM = ParGen_FM;
                app.parGenPronouns();
            }
        };
        var Setup_6_If_ParGen_MF_2_trial = {
            timeline: [Setup_6_If_ParGen_MF_2],
            post_trial_gap: 0,
            conditional_function: function(){
                if (ParGen_MF == 2){
                    return true;
                } else {
                    return false;
                }
            }
        };
        /*7*/
        var Setup_7_PhoneOS = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "What type of device do you have?",
            choices: ['iPhone or other Apple device', 'Android phone or Android device'],
            data: {WhatWasRating:'Setup_PhoneOS'},
            css_classes: ['trial'],
            on_finish: function(){
                deviceOS = jsPsych.data.getLastTrialData().values()[0].response;
            }
        };
        /*8*/
        var Setup_8_RequestNotifPermission = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Next, we will request permission to send notifications to you.<br><br>Please click the button below to receive a <b>request to allow notifications</b>.",
            choices: ['Request permission to allow notifications'],
            data: {WhatWasRating:'Setup_RequestNotifPermission'},
            css_classes: ['trial'],
            on_finish: function(){
                /* request permission to send notifs */
                if (deviceOS == 0 || /iPhone|iPad|iPod/i.test(navigator.userAgent) == true){ // if participant is using iOS
                    // request permissions by scheduling a test notification
                    var id = '9998';
                    cordova.plugins.notification.local.setDefaults({
                        vibrate: true,
                        icon: 'res://img/icon.png',
                        smallIcon: 'res://img/icon.png'
                    });
                    /* send test notification */
                    cordova.plugins.notification.local.schedule({
                        icon: 'ic_launcher',
                        id: id,
                        title: 'Daily Surveys',
                        text: 'Your test notification has fired!',
                        trigger: {in: 3, unit: 'second'},
                        });
                } else if (deviceOS == 1 || /Android/i.test(navigator.userAgent) == true){ // if participant is using android
                    // request permissions using the cordova notification permission request module for android 13+, api33+
                    function permerrorCallback() {
                        console.warn('You have not granted this app permission to receive notifications. Please navigate to Settings > App Info and toggle notifications for this app.');
                    };
                    function permsuccessCallback( status ) {
                        if( !status.hasPermission ) permerrorCallback();
                    };
                    permissions.requestPermission(permissions.POST_NOTIFICATIONS, permsuccessCallback, permerrorCallback);
                };
            },
        };
        /*9*/
        var Setup_9_TestNotification = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Next, we will test whether the notification system is working on your phone. Please click the button below to test the notification system. <br/><br/> You will receive a notification in 10 seconds. <b>If you see the notification, DO NOT CLICK ON IT.</b> <i>Clicking on it will interrupt your app setup.</i> <br/><br/> Please return to the app after you have seen the notification or 10 seconds have passed.",
            choices: ['Test notification now'],
            data: {WhatWasRating:'Setup_TestNotification'},
            css_classes: ['setup'],
            on_finish: function(){
                /* set notification defaults */
                var id = '9999';
                cordova.plugins.notification.local.setDefaults({
                    vibrate: true,
                    icon: 'res://img/icon.png',
                    smallIcon: 'res://img/icon.png'
                })
                /* send test notification */
                cordova.plugins.notification.local.schedule({
                    icon: 'ic_launcher',
                    id: id,
                    title: 'Daily Surveys',
                    text: 'Your test notification has fired!',
                    trigger: {in: 3, unit: 'second'},
                    });
            }
        };
        /*10*/
        var Setup_10_TestNotifSuccess = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Did you receive the test notification? (Please wait up to 10 seconds.)",
            choices: ['No','Yes'],
            data: {WhatWasRating:'Setup_TestNotifSuccess'},
            css_classes: ['trial'],
            on_finish: function(){
                notifTestSuccess = jsPsych.data.getLastTrialData().values()[0].response;
            }
        };
        /*11*/
        // if test notification did not go through, tell participant their phone may be incompatible or to try again by manually enabling notifications.
        var Setup_10_TestNotifFail = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "It looks like notifications are not working for this app. You are ineligible to participate in our study. <br/><br/> If you think that an error has occurred, please restart the setup process by clicking the button below, or by reinstalling the app, and manually enabling notification permissions in your App Settings. <br/><br/> For assistance, contact us at crockett.laboratory@gmail.com.",
            choices: ['An error has occurred - Restart Setup'],
            data: {WhatWasRating:'Setup_TestNotifFail'},
            css_classes: ['trial'],
            on_finish: function(){
                localStore.clear(); // clear local storage and cache 
                jsPsych.endCurrentTimeline() // end timeline
                jsPsych.endExperiment("Clearing local storage...") // end experiment
                pID = ' ';
                jsPsych.run(timeline);
                console.log("CLEARED");
            }
        };
        var Setup_10_TestNotifFail_trial = {
            timeline: [Setup_10_TestNotifFail],
            post_trial_gap: 0,
            conditional_function: function(){
                if (notifTestSuccess == 0){
                    return true;
                } else {
                    return false;
                }
            }
        };
        /*12*/
        var Setup_11_Survey1Start = {
            type: jsPsychSurveyHtmlForm,
            html: '<br><input name="Survey1Start" type="time" id="timepicker"/><br><br>',
            autofocus: 'timepicker',
            preamble: "We will now ask you to select two blocks of time when you expect to be <b>around other people but still have your phone with you</b> to complete the survey.<br/><br/>Please choose a time in the first half of your day when you'll be around people and have access to your phone for ~3 hours. <br/><br/>When does your <b>FIRST</b> block of time <b>START</b>?",
            data: {WhatWasRating:'Setup_Survey1Start'},
            css_classes: ['setup'],
            required: true,
            on_finish: function(){
                /* retrieve the time stamp*/
                jsPsych.data.getLastTrialData().values()[0].response = Object.values(jsPsych.data.getLastTrialData().values()[0].response).flat().join();
                localStore.survey1Start = jsPsych.data.getLastTrialData().values()[0].response;
            }
        };
        // repeats previous trial if the selected start time is invalid
        // (it must be at least X hours before midnight as determined by surveyblockhour variable)
        var Setup_11_Survey1Start_loop = { 
            timeline: [Setup_11_Survey1Start],
            loop_function: function(data){
                var isTime1Invalid = app.invalidTime1(data);
                if (isTime1Invalid == true){
                    alert("Please enter a time that is earlier than 21:00 (9pm) in your timezone.") //**CHANGEME */
                    return true;
                } else {
                    return false;
                }
            }
        };
        /*13*/
        var Setup_12_Survey2Start = {
            type: jsPsychSurveyHtmlForm,
            html: '<br><input name="Survey2Start" type="time" id="timepicker"/><br><br>',
            autofocus: 'timepicker',
            preamble: "We will now ask you to select two blocks of time when you expect to be <b>around other people but still have your phone with you</b> to complete the survey.<br/><br/>Please choose a time in the second half of your day when you'll be around people and have access to your phone for ~3 hours. <br/><br/>When does your <b>SECOND</b> block of time <b>START</b>?",
            data: {WhatWasRating:'Setup_Survey2Start'},
            css_classes: ['setup'],
            required: true,
            on_finish: function(){
                /* retrieve the time stamp*/
                jsPsych.data.getLastTrialData().values()[0].response = Object.values(jsPsych.data.getLastTrialData().values()[0].response).flat().join();
                localStore.survey2Start = jsPsych.data.getLastTrialData().values()[0].response;
            }
        };
        // repeats previous trial if the selected start time is invalid
        // (it must be at least X hours after the start time of the previous survey interval as determined by surveyblockhour variable)
        var Setup_12_Survey2Start_loop = { 
            timeline: [Setup_12_Survey2Start],
            loop_function: function(data){
                var isTime2Invalid = app.invalidTime2(data);
                if (isTime2Invalid == true){
                    alert("Please enter a time that is at least 3 hours after the previous time that you picked.") //**CHANGEME */
                    return true;
                } else {
                    // if both survey start times are valid, then schedule notifications 
                    app.scheduleNotifs();
                    var notifs_dates = notifs.map(app.convertEpochTime); // convert notifications to human readable time
                    jsPsych.data.addProperties({
                        notifs_Epoch: notifs,
                        notifs_Dates: notifs_dates,
                    });
                    return false;
                }
            }
        };
        /* setup ID */
        var Setup_Timeline = {
            timeline: [
                Setup_0_Welcome,
                Setup_1_ID1,
                Setup_2_ID2,
                Setup_3_ID3,
                Setup_4_ID_Validation,
                Setup_5_ParGen_MF,
                Setup_6_If_ParGen_MF_2_trial,
                Setup_7_PhoneOS,
                Setup_8_RequestNotifPermission,
                Setup_9_TestNotification,
                Setup_10_TestNotifSuccess,
                Setup_10_TestNotifFail_trial,
                Setup_11_Survey1Start_loop, 
                Setup_12_Survey2Start_loop
            ],
            randomize_order: false
        };
        timeline.push(Setup_Timeline);
    },
    loadSurvey:function(){
        jsPsych.randomization.setSeed(); // re-randomize question order with new seed
        
        //**Q1 - Rating Yourself */
        var RateYourself_instructions = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Think about your thoughts, feelings, and behavior <u>in the past hour</u>. Please do your best to honestly evaluate yourself on the following traits.",
            choices: ['NEXT'],
            data: {WhatWasRating:'INSTRUCTIONS'},
            css_classes: ['instructions'],
        };
        var RateYourself_com = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How competent are you? That is, how capable are you at doing things in general?",
            choices: ['1-Not at all competent', '2', '3', '4-Neutral', '5', '6', '7-Very competent'],
            data: {WhatWasRating:'RateYourself_com'},
            css_classes: ['trial'],
        };
        var RateYourself_int = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How intelligent are you? That is, how easily do you learn or understand new things or problems in general?",
            choices: ['1-Not at all intelligent', '2', '3', '4-Neutral', '5', '6', '7-Very intelligent'],
            data: {WhatWasRating:'RateYourself_int'},
            css_classes: ['trial'],
        };
        var RateYourself_fri = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How friendly are you? That is, how sociable and pleasant are you in general?",
            choices: ['1-Not at all friendly', '2', '3', '4-Neutral', '5', '6', '7-Very friendly'],
            data: {WhatWasRating:'RateYourself_fri'},
            css_classes: ['trial'],
        };
        var RateYourself_tru = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How trustworthy are you? That is, how much can you be relied upon as honest and truthful in general?",
            choices: ['1-Not at all trustworthy', '2', '3', '4-Neutral', '5', '6', '7-Very trustworthy'],
            data: {WhatWasRating:'RateYourself_tru'},
            css_classes: ['trial'],
        };
        var RateYourself_att = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How attractive are you? That is, how physically appealing do you look to people in general?",
            choices: ['1-Not at all attractive', '2', '3', '4-Neutral', '5', '6', '7-Very attractive'],
            data: {WhatWasRating:'RateYourself_att'},
            css_classes: ['trial'],
        };
        var RateYourself_dom = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How dominant are you? That is, how powerful, controlling, or commanding are you in general?",
            choices: ['1-Not at all dominant', '2', '3', '4-Neutral', '5', '6', '7-Very dominant'],
            data: {WhatWasRating:'RateYourself_dom'},
            css_classes: ['trial'],
        };
        // Q1 - define task array
        var Q1_RateYourself_array = [
                RateYourself_att,
                RateYourself_com,
                RateYourself_dom,
                RateYourself_fri,
                RateYourself_int,
                RateYourself_tru,
        ];
        /* use jsPsych.randomization.shuffle to randomize the order of the trials, then add to the timeline in random order */
        var Q1_RateYourself_array_random = jsPsych.randomization.shuffle(Q1_RateYourself_array);
        var Q1_RateYourself_block = {
            timeline: Q1_RateYourself_array_random,
        };
        timeline.push(RateYourself_instructions);
        timeline.push(Q1_RateYourself_block);
    
        //**Q2 - Social Situations: Alone or With Others */
        // depending on whether the participant is alone or with others, trigger different timelines
        var Q2_AloneOrWithOthers = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Are you currently alone or with other people?";
                return text;
            },
            choices: ['I am alone', 'I am with other people'],
            data: {WhatWasRating:'SocialSit_AloneWithOthers'},
            css_classes: ['trial'],
            on_finish: function(){ // set var to determine which blocks of social situation questions to display
                cond_AloneWithOther = jsPsych.data.getLastTrialData().values()[0].response;
            }
        };
    
        //**Q2 - Social Situations - With Others**//
        /* questions to be asked when participants are with others */
        var Q2_HowClose = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "In your current situation, how close are you to the people around you?<p style='font-weight:normal;'>That is, to what extent are your relationships with the people around you characterized by deeply understanding each other, accepting and validating each other's natures, and striving to care for and promote each other's overall well-being?</p>",
            choices: ['1-Not at all close','2','3','4-Neutral','5','6','7-Very close'],
            data: {WhatWasRating:'HowClose'},
            css_classes: ['trial'],
        };
        var Q2_HowManyM = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How many people with you are men?",
            choices: ['0','1','2','3','4','5','6','7','8','9+'],
            data: {WhatWasRating:'HowManyM'},
            css_classes: ['trial'],
        };
        var Q2_HowManyF = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "How many people with you are women?",
            choices: ['0','1','2','3','4','5','6','7','8','9+'],
            data: {WhatWasRating:'HowManyF'},
            css_classes: ['trial'],
        };
        var Q2_WithOthers_Endorsement_general = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "<b>Do you share the same views about <u>"+ParGenPlural+" in general</u> as the people around you <u>right now?</u><br><br>That is, do you agree or disagree with how they see "+ParGenPlural+"?</b>";
                return text;
            },
            choices: ['1-Strongly disagree','2-Disagree','3-Slightly disagree','4-Neither agree nor disagree','5-Slightly agree','6-Agree','7-Strongly agree'],
            data: {WhatWasRating:'Endorsement_general'},
            css_clases: ['trial'],
        };
        var Q2_WithOthers_Endorsement_ideal = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "<b>Do you share the same views about the <u>ideal "+ParGenSingular+"</u> as the people around you <u>right now?</u><br><br>That is, do you agree or disagree with how they see the ideal "+ParGenSingular+"?</b>";
                return text;
            },
            choices: ['1-Strongly disagree','2-Disagree','3-Slightly disagree','4-Neither agree nor disagree','5-Slightly agree','6-Agree','7-Strongly agree'],
            data: {WhatWasRating:'Endorsement_ideal'},
            css_clases: ['trial'],
        };
        var Q2_WithOthers_ThirdOrderSimilarity_general = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Right now, do the people around you see you as similar to <u>most other "+ParGenPlural+"?</u>";
                return text;
            },
            choices: function(){
                var text = ['1-People here do not see me as similar to other PARGENPLURAL at all','2','3','4-People here see me as somewhat similar to other PARGENPLURAL','5','6','7-People here see me as very similar to other PARGENPLURAL'];
                text = text.map(function (choice) {return choice.replace("PARGENPLURAL", ParGenPlural);}); // dynamically replace gendered references in array
                return text;
            },
            data: {WhatWasRating:'ThirdOrderSimilarity_general'},
            css_classes: ['trial'],
        };
        var Q2_WithOthers_ThirdOrderSimilarity_ideal = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Right now, do the people around you see you as similar to the <u>ideal "+ParGenSingular+"?</u>";
                return text;
            },
            choices: function(){
                var text = ['1-People here do not see me as similar to the ideal PARGENSINGULAR at all','2','3','4-People here see me as somewhat similar to the ideal PARGENSINGULAR','5','6','7-People here see me as very similar to the ideal PARGENSINGULAR'];
                text = text.map(function (choice) {return choice.replace("PARGENSINGULAR", ParGenSingular);}); // dynamically replace gendered references in array
                return text;        },
            data: {WhatWasRating:'ThirdOrderSimilarity_ideal'},
            css_classes: ['trial'],
        };
        var Q2_FirstOrderSimilarity_general = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Right now, do you see yourself as similar to <u>most other "+ParGenPlural+"?</u>";
                return text;
            },
            choices: function(){
                var text = ['1-I do not see myself as similar to other PARGENPLURAL at all','2','3','4-I see myself as somewhat similar to other PARGENPLURAL','5','6','7-I see myself as very similar to other PARGENPLURAL'];
                text = text.map(function (choice) {return choice.replace("PARGENPLURAL", ParGenPlural);}); // dynamically replace gendered references in array
                return text;
            },
            data: {WhatWasRating:'FirstOrderSimilarity_general'},
            css_classes: ['trial'],
        };
        var Q2_FirstOrderSimilarity_ideal = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Right now, do you see yourself as similar to <u>the ideal "+ParGenSingular+"?</u>";
                return text;
            },
            choices: function(){
                var text = ['1-I do not see myself as similar to the ideal PARGENSINGULAR at all','2','3','4-I see myself as somewhat similar to the ideal PARGENSINGULAR','5','6','7-I see myself as very similar to the ideal PARGENSINGULAR'];
                text = text.map(function (choice) {return choice.replace("PARGENSINGULAR", ParGenSingular);}); // dynamically replace gendered references in array
                return text;
            },
            data: {WhatWasRating:'FirstOrderSimilarity_ideal'},
            css_classes: ['trial'],
        };
        //**Q2 - Social Situations - Alone**//
        /* questions to be asked when participants are by themselves */
        var Q2_Alone_Endorsement_general = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Do you share the same views about <u>"+ParGenPlural+" in general</u> as the people who were <u>most recently</u> around you?<br><br>That is, do you agree or disagree with how they see "+ParGenPlural+"?";
                return text;
            },
            choices: ['1-Strongly disagree','2-Disagree','3-Slightly disagree','4-Neither agree nor disagree','5-Slightly agree','6-Agree','7-Strongly agree'],
            data: {WhatWasRating:'Endorsement_general'},
            css_classes: ['trial'],
        };
        var Q2_Alone_Endorsement_ideal = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Do you share the same views about the <u>ideal "+ParGenSingular+"</u> as the people who were <u>most recently</u> around you?<br><br>That is, do you agree or disagree with how they see "+ParGenSingular+"?";
                return text;
            },
            choices: ['1-Strongly disagree','2-Disagree','3-Slightly disagree','4-Neither agree nor disagree','5-Slightly agree','6-Agree','7-Strongly agree'],
            data: {WhatWasRating:'Endorsement_ideal'},
            css_classes: ['trial'],
        };
        var Q2_Alone_ThirdOrderSimilarity_general = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Think of the people who were most recently around you. Do they see you as similar to <u>most other "+ParGenPlural+"?</u>";
                return text;
            },
            choices: function(){
                var text = ['1-They do not see me as similar to other PARGENPLURAL at all','2','3','4-They see me as somewhat similar to other PARGENPLURAL','5','6','7-They see me as very similar to other PARGENPLURAL'];
                text = text.map(function (choice) {return choice.replace("PARGENPLURAL", ParGenPlural);}); // dynamically replace gendered references in array
                return text;
            },
            data: {WhatWasRating:'ThirdOrderSimilarity_general'},
            css_classes: ['trial'],
        };
        var Q2_Alone_ThirdOrderSimilarity_ideal = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Think of the people who were most recently around you. Do they see you as similar to the <u>ideal "+ParGenSingular+"?</u>";
                return text;
            },
            choices: function(){
                var text = ['1-They do not see me as similar to the ideal PARGENSINGULAR at all','2','3','4-They see me as somewhat similar to the ideal PARGENSINGULAR','5','6','7-They see me as very similar to the ideal PARGENSINGULAR'];
                text = text.map(function (choice) {return choice.replace("PARGENSINGULAR", ParGenSingular);}); // dynamically replace gendered references in array
                return text;
            },
            data: {WhatWasRating:'ThirdOrderSimilarity_ideal'},
            css_classes: ['trial'],
        };
        // Q2_FirstOrderSimilarity_general and Q2_FirstOrderSimilarity_alone - ask this when participants are alone as well
        // Q2 - define task list
        var Q2_WithOthers_array = [
                Q2_HowClose,
                Q2_HowManyF,
                Q2_HowManyM,
                Q2_WithOthers_Endorsement_general,
                Q2_WithOthers_Endorsement_ideal,
                Q2_WithOthers_ThirdOrderSimilarity_general,
                Q2_WithOthers_ThirdOrderSimilarity_ideal,
                Q2_FirstOrderSimilarity_general,
                Q2_FirstOrderSimilarity_ideal,
        ];
        var Q2_Alone_array = [
                Q2_Alone_Endorsement_general,
                Q2_Alone_Endorsement_ideal,
                Q2_Alone_ThirdOrderSimilarity_general,
                Q2_Alone_ThirdOrderSimilarity_ideal,
                Q2_FirstOrderSimilarity_general,
                Q2_FirstOrderSimilarity_ideal
        ];
        // randomly shuffle order
        var Q2_WithOthers_array_random = jsPsych.randomization.shuffle(Q2_WithOthers_array);
        var Q2_Alone_array_random = jsPsych.randomization.shuffle(Q2_Alone_array);
        // add to timeline
        var Q2_WithOthers_block = {timeline: Q2_WithOthers_array_random};
        var Q2_Alone_block = {timeline: Q2_Alone_array_random};
        // Q2 - create conditional nodes to determine which timeline to run, depending on whether p is alone or with others
        var Q2_WithOthers_Conditional = {
            timeline: [Q2_WithOthers_block],
            post_trial_gap: 0,
            conditional_function: function(){
                if (cond_AloneWithOther == 1){
                    return true;
                } else {
                    return false;
                }
            }
        };
        var Q2_Alone_Conditional = {
            timeline: [Q2_Alone_block],
            post_trial_gap: 0,
            conditional_function: function(){
                if (cond_AloneWithOther == 0){
                    return true;
                } else {
                    return false;
                }
            }
        };
        timeline.push(Q2_AloneOrWithOthers);
        timeline.push(Q2_WithOthers_Conditional);
        timeline.push(Q2_Alone_Conditional);
    
        //**Q3 - Mental health, mood, and well-being measures */
        var Q3_MoodEnergy = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = 'Thinking about your <u>energy level</u> in the <u>past hour</u>, how do you feel?';
                return text;
            },
            choices: ['1-Very sleepy', '2', '3', '4-Neutral', '5', '6', '7-Very alert'],
            data: {WhatWasRating:'Mood_Energy'},
            css_classes: ['trial'],
        };
        var Q3_MoodValence = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = 'Thinking about your <u>mood</u> in the <u>past hour</u>, how do you feel?';
                return text;
            },
            choices: ['1-Very negative', '2', '3', '4-Neutral', '5', '6', '7-Very positive'],
            data: {WhatWasRating:'Mood_Valence'},
            css_classes: ['trial'],
        };
        var Q3_WellBeing = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = 'Taking everything into consideration, how well have you been doing in the <u>past hour</u>?';
                return text;
            },
            choices: ['1-Terrible', '2-Very poor', '3-Poor', '4-Fair', '5-Good', '6-Very good', '7-Excellent'],
            data: {WhatWasRating:'WellBeing'},
            css_classes: ['trial'],
        };
        var Q3_Anxiety = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = 'Please rate to what extent the following words describe your current mood:<br><br><u>Anxious</u>';
                return text;
            },
            choices: ['1-Not at all anxious', '2', '3', '4-Somewhat anxious', '5', '6', '7-Very anxious'],
            data: {WhatWasRating:'Anxiety'},
            css_classes: ['trial'],
        };
        var Q3_Sad = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = 'Please rate to what extent the following words describe your current mood:<br><br><u>Sad</u>';
                return text;
            },
            choices: ['1-Not at all sad', '2', '3', '4-Somewhat sad', '5', '6', '7-Very sad'],
            data: {WhatWasRating:'Sad'},
            css_classes: ['trial'],
        };
        var Q3_SelfEsteem = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = 'Thinking about yourself in the <u>past hour</u>, to what extent do you agree with this statement? <br/><br/><u>I have high self-esteem.</u>';
                return text;
            },
            choices: ['1-Not very true of me', '2', '3', '4-Neither true nor untrue of me', '5', '6', '7-Very true of me'],
            data: {WhatWasRating:'SelfEsteem'},
            css_classes: ['trial'],
        };
        // put trials into block
        var Q3_WellBeing_array = [
                Q3_MoodEnergy,
                Q3_MoodValence,
                Q3_Anxiety,
                Q3_Sad,
                Q3_WellBeing,
                Q3_SelfEsteem,
        ];
        // randomly shuffle block
        var Q3_WellBeing_array_random = jsPsych.randomization.shuffle(Q3_WellBeing_array);
        var Q3_WellBeing_block = {
            timeline: Q3_WellBeing_array_random,
        };
        timeline.push(Q3_WellBeing_block);  
    },
    loadEndofSurvey:function(){
        //** End of survey messages */
        // the following code blocks deal with different types of messages you want to display to participants upon completing a survey,
        // whether in the middle of the study or at the end
        
        /* increase surveyCounter */
        var increaseSurveyCounter = {
            type: jsPsychCallFunction,
            func: function(){app.increaseSurveyCount()},
        };
        
        /* add variables to datafile */
        var Add_Variables = {
            type: jsPsychCallFunction,
            func: function(){app.addGlobalVars()},
        };
        /* write data to OSF using Datapipe (responses only) */
        //**CHANGEME */
        const save_data_OSF = {
            type: jsPsychPipe,
            action: "save",
            experiment_id: "qwRXQ37fP2aQ", //**CHANGEME */
            filename: filename,
            data_string: ()=>jsPsych.data.get().csv()
        };
        
        /* write data to firebase */
        var save_data_Firebase = {
            type: jsPsychCallFunction,
            func: function(){
                app.saveDataFirebase();
            }
        };
        /* display end of setup message if data saved successfully */
        var End_of_Setup = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Your responses have been recorded. Thank you for completing setup - the study will begin tomorrow. <br/><br/>Please make sure notifications for the app are turned on. <br /><br/> Please close the app completely to ensure you will receive your next notifications (Swipe the app up). <br /><br />You can now close the app.",
            choices: ['FINISH SURVEY'],
            data: {WhatWasRating:'END_OF_SETUP'},
            css_classes: ['trial'],
            on_start: function(){
                snoozed = 0; // reset snooze variable
                localStore.snoozed = 0;
            },
            on_finish: function(){
                settingup = false;
                jsPsych.endCurrentTimeline();
            }
        };
        /* display end of survey message if data saved successfully */
        var End_of_Survey = {
            type: jsPsychHtmlButtonResponse,
            stimulus: function(){
                var text = "Thank you! Your responses have been recorded. You have completed "+localStore.surveyCount+" surveys so far, for $"+(parseInt(localStore.surveyCount)*0.40)+" to be paid at the end of the study (plus a bonus if you do not miss more than 7 surveys). <br/><br/>Please make sure notifications for the app are turned on. <br /><br/> Please close the app completely to ensure you will receive your next notifications (Swipe the app up). <br /><br />You can now close the app.";
                return text;
            },
            choices: ['FINISH SURVEY'],
            data: {WhatWasRating:'END_OF_SURVEY'},
            css_classes: ['trial'],
            on_start: function(){
                snoozed = 0; // reset snooze variable
                localStore.snoozed = 0;
                settingup = false; 
            },
            on_finish: function(){
                jsPsych.endCurrentTimeline();
            }
        };
        // the messages below will play if participants have finished the entire study
        var End_of_Study_Feedback = {
            type: jsPsychSurveyText,
            preamble: function() {
                var text = "Thank you for your participation! The study is now complete.";
                return text;
            },
            questions: [
                {prompt: '<p style="font-weight: normal;">If you encountered any difficulties completing the surveys, please briefly describe them below.', rows:4, columns:40, required: false, name:'End_of_Study_Feedback'},
            ],
            data: {WhatWasRating: 'End_of_Study_Feedback'},
            css_classes: ['trial'],
        };
        var End_of_Study = {
            type: jsPsychHtmlButtonResponse,
            stimulus: "Thank you for your participation! <br><br>Please read the debriefing message on the next page.",
            choices: ['NEXT'],
            data: {WhatWasRating:'STUDY_COMPLETE'},
            css_classes: ['instructions'],
            on_start: function(){
                app.saveDataFirebase(); // save data to firebase
                snoozed = 0;
                settingup = false;
            },
        };
        var Debriefing = {
            type: jsPsychHtmlButtonResponse,
            stimulus: '<p style="font-weight:bold;">Thank you for taking the time to participate in our study!</p><p style="font-weight:normal;">Research in our laboratory is concerned with the psychological mechanisms underlying how social contexts shape our identity. <br>For example, we are interested in how societal ideas about gender change the way that people see, think, and feel about themselves.<br><br>To investigate this question, we asked you to evaluate yourself on various traits, <br>to evaluate the traits that are representative of a typical person in a gender category, <br>and to report on your well-being and your ideas about gender.</p><p style="font-weight:bold;">If you have general questions about this study please contact:</p><p style="font-weight:normal;">Principal Investigator: Dr. Molly Crockett; mc5121@princeton.edu, crockett.laboratory@gmail.com</p><p style="font-weight:bold;">If you have questions regarding your rights as a research subject, or if problems arise which <br>you do not feel you can discuss with the investigator, please contact the Institutional Review Board at:</p><p style="font-weight:normal;">Assistant Director, Research Integrity and Assurance<br>Phone: (609) 258-8542<br>Email: irb@princeton.edu</p><p style="font-weight:bold;">. <b>We will review our records and send your payment within 7 days.</b></p>',
            choices: ['FINISH STUDY'],
            data: {WhatWasRating:'DEBRIEFING'},
            css_classes: ['longtext'],
        };
        
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
        //**Push end of survey blocks to timeline */
        
        // check if participants are competing setup, finishing a survey, or have finished the entire study
        if (settingup == true){
            app.parGenPronouns(); // declare and store binary gendered pronouns
            // save setup info and display end of setup messages
            timeline.push(Add_Variables);
            timeline.push(save_data_Firebase);
            timeline.push(End_of_Setup);
        } else if (parseInt(surveyCount) < parseInt(surveyCountMax) && snoozed != 1){ 
            // save survey data and display end of survey messages
            timeline.push(increaseSurveyCounter);
            timeline.push(Add_Variables);
            timeline.push(save_data_OSF);
            timeline.push(save_data_Firebase);
            timeline.push(End_of_Survey);
        } else if (parseInt(surveyCount) == parseInt(surveyCountMax) && snoozed != 1){ 
            // if study is complete, save data and display end of study messages
            timeline.push(increaseSurveyCounter);
            timeline.push(End_of_Study_Feedback);
            timeline.push(Add_Variables);
            timeline.push(save_data_OSF);
            timeline.push(save_data_Firebase);
            timeline.push(End_of_Study);
            timeline.push(Debriefing);
        };
    },

    checkAccess: function(){
        // check what type of access participants should have to the app

        if(localStore.pID === " " || localStore.pID == "" || !localStore.pID || localStore.pID == "undefined"){
            // setup questions will run if this is the participant's first time using the app
            settingup = true;
            surveytime = false;
            appReady.loadSetup(); // load setup questions
            appReady.loadEndofSurvey(); // load end-of-survey questions
            jsPsych.run(timeline); // display the whole jspsych timeline

        } else if (now < localStore.surveyStart){ // display this message if participants access the app before the study has started
            surveytime = false;
            var studyHasntStarted = {
                type: jsPsychHtmlButtonResponse,
                stimulus: "This study has not started yet. Please wait until you receive a notification before launching the app.",
                choices: ['NEXT'],
                data: {WhatWasRating:'StudyHasNotStarted'},
                css_classes: ['trial'],
                on_finish: function(){
                    jsPsych.endExperiment("Please close the app fully (swipe the app up).")
                }        
            };
            timeline.push(studyHasntStarted); // push this message to timeline
            jsPsych.run(timeline); // display the timeline

        } else if (now > localStore.surveyEnd){ // display this message if participants access the app when the study has ended
            surveytime = false;
            var studyHasEnded = {
                type: jsPsychHtmlButtonResponse,
                stimulus: "The study has now finished. You can now delete the app, but we would advise you to keep it until you have received your payment.",
                choices: ['NEXT'],
                data: {WhatWasRating:'StudyHasEnded'},
                css_classes: ['trial'],
                on_finish: function(){
                    jsPsych.endExperiment("Please close the app fully (swipe the app up).")
                }
            };
            timeline.push(studyHasEnded); // push this message to timeline
            jsPsych.run(timeline); // display the timeline
        
        } else {
            // if the study has started and has not yet finished, we will loop through all surveys that
            //  are scheduled to fire and check which survey the participant is going to see
            for (var j = 0; j < surveyCountMax; j++){ //**CHANGEME */
        
                // for each survey block, parse the start and end times when it will be available to the participant
                var notifArray = localStore.notifs.split(","); 
                var start = parseInt(notifArray[j]);
                var end = (parseInt(notifArray[j]) + parseInt(surveyWindow));

                // check if the current time is within the survey interval
                if (parseInt(now) > parseInt(start) && parseInt(now) < parseInt(end)){ 
                    // if it is, set a variable to initialize the survey and show the welcome back message and snooze questions
                    surveytime = true;
                    console.log("Is it surveytime? "+surveytime);
                    // if it's time for the current survey to fire, break the loop (super important bc this loops through all notification times,
                    // checking if they should fire; by breaking the loop, we prevent the surveytime variable from being overwritten by a future survey time)
                    break;

                } else if (parseInt(now) < parseInt(start) || parseInt(now) > parseInt(end)) {
                    // if it is not time for a survey to fire, set the surveytime variable to false
                    surveytime = false;
                    console.log("Is it surveytime? "+surveytime);
                }
            };
            
            // once we've looped through all surveys and declared a final state for the surveytime variable,
            // either display the welcome back & snooze messages or a message that it's not time to do a survey yet

            if (surveytime == true){
                // if it's time for a survey, show the welcome back and snooze messages, and load survey questions
                var welcomeBack = {
                    type: jsPsychHtmlButtonResponse,
                    stimulus: function(){
                        surveyCount = localStore.surveyCount;
                        var text = "<img src='img/icon_alt.png' width=50px; height=50px;><br><b>Daily Studies About the Self</b><p style='font-weight: normal;'>Welcome back to the study! You have completed "+localStore.surveyCount+" out of 42 surveys so far during this phase of the study. <br/><br/>Please proceed to the survey if that looks correct. Otherwise, please contact us on Prolific or at crockett.laboratory@gmail.com.";
                        return text;
                    },                
                    choices: ['NEXT'],
                    data: {WhatWasRating:'WELCOMEBACK'},
                    css_classes: ['instructions'],
                };
                /*snooze question, where selecting "No" snoozes the app for a predetermined amount of time*/
                var snoozeQuestion = {
                    type: jsPsychHtmlButtonResponse,
                    stimulus: "Are you able to take the survey now?",
                    choices: ['Yes','No - snooze the app'],
                    data: {WhatWasRating:'SNOOZE'},
                    css_classes: ['trial'],
                    on_finish: function(){
                        snoozed = jsPsych.data.getLastTrialData().values()[0].response;
                        localStore.snoozed = snoozed;
                        if(snoozed == 1){
                            console.log("snoozed! we'll message you later.");
                            app.snoozeNotif(); // schedule snoozed notif
                            app.addGlobalVars(); // add global vars 
                            app.saveDataFirebase(); // save data
                            jsPsych.endExperiment("<b>Snoozed! We'll message you later.</b></br></br>Please close the app fully (swipe the app up).")
                        } else {console.log("initiating survey questions");}
                    },
                };
                timeline.push(welcomeBack); // push welcome back message to timeline
                timeline.push(snoozeQuestion); // push snooze question to timeline
                appReady.loadSurvey(); // load & push survey questions
                appReady.loadEndofSurvey(); // load & push end-of-survey messages
                jsPsych.run(timeline); // instantiate the timeline

            } else if (surveytime == false){
                // if the current time is not within the scheduled survey window, display 'no survey available' message
                var noSurveyAvailable = {
                    type: jsPsychHtmlButtonResponse,
                    stimulus: "It is not time for you to complete a survey now. Please wait until your next notification.<br/><br/>Please close the app fully (swipe the app up).<br/><br/>If you believe you received this message in error, please click on the 'debug app' button below, and then contact us on Prolific or at crockett.laboratory@gmail.com.",
                    choices: ['CHECK BACK LATER', 'Debug app'],
                    data: {WhatWasRating:'NoSurveyAvailable'},
                    css_classes: ['trial'],
                    on_finish: function(){
                        if(jsPsych.data.getLastTrialData().values()[0].response == 0){
                            jsPsych.endExperiment("Please close the app fully (swipe the app up).")
                        };
                    }
                };
                timeline.push(noSurveyAvailable);
                var noSurveyDebug = {
                    type:jsPsychHtmlButtonResponse,
                    stimulus: function(){
                        var text = "The current time (epoch) is: "+now+".<br>The survey start times are: "+String(localStore.notifs)+".<br> The last survey end time is "+end+".<br>Your surveyCount is "+localStore.surveyCount+" out of 42.<br>You have missed "+localStore.missingSurveyCount+" surveys.<br>Your pID is "+localStore.pID+".<br><br>Please save this information and send it to us on Prolific or at crockett.laboratory@gmail.com.<br><br>Please close the app fully (swipe the app up.)";
                        return text;
                    },
                    choices: ['END SURVEY','Reload page and try again'],
                    data: {WhatWasRating:'DebugNotif'},
                    css_classes: ['trial'],
                    on_finish: function(){
                        if (jsPsych.data.getLastTrialData().values()[0].response == 0){
                            jsPsych.endExperiment("Please close the app fully (swipe the app up).")
                        } else {
                            jsPsych.endCurrentTimeline(); // end timeline
                            timeline = [];
                            app.reinitjsPsych(); // reinitialize jsPsych
                            app.initCurrent(); // reinitialize current app
                            appReady.checkAccess(); // reinitialize survey access check
                        }
                    }
                };
                var noSurveyDebug_Conditional = {
                    timeline: [noSurveyDebug],
                    post_trial_gap: 0,
                    conditional_function: function(){
                        if (jsPsych.data.getLastTrialData().values()[0].response == 1){
                            return true;
                        } else {
                            return false;
                        }
                    }
                };
                timeline.push(noSurveyDebug_Conditional);

                jsPsych.run(timeline); // run timeline
            };
        };
    },
};

/* Run the whole thing for the first time */
app.initCurrent();
appReady.checkAccess();


