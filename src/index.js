// import fs from 'fs';
import path from 'path';
import rtlsdr from 'rtl-sdr';
import Demodulator from 'mode-s-demodulator';
import { connect } from 'mongodb';

const numDevices = rtlsdr.get_device_count()
if (!numDevices) {
    console.error('No RTLSDR devices found. Closing application!')
    process.exit(0);
}

console.log(`Number of connected devices: ${numDevices}`);

// Open device connection
const device = rtlsdr.open(0);
// Setup device gain, frequency and sample rate
rtlsdr.set_tuner_gain_mode(device, 0);
rtlsdr.set_freq_correction(device, 0);
rtlsdr.set_center_freq(device, 1090000000);
rtlsdr.set_sample_rate(device, 2000000);
rtlsdr.reset_buffer(device);

const demodulator = new Demodulator();
// const file = path.join(__dirname,'../dump','airtrack.json');
let db = null, flight = null;
connect('mongodb://localhost:27017').then(client => { 
    db = client.db("airtrack");
    flight = db.collection('flight');
});

const identities = [];
const aircrafts = [];

// Start reading broadcast messages from the aircrafts
rtlsdr.read_async(
    device,
    (data, len) => {
        demodulator.process(data, len, (msg) => {
            console.log(msg);
            
            const payload = {
                icao: msg.callsign.slice(0,3), // msg.icao,
                callsign: msg.callsign,
                identity: msg.identity,
                aircraftType: msg.aircraftType,
                rawLatitude: msg.rawLatitude,
                rawLongitude: msg.rawLongitude,
                speed: msg.speed,
                altitude: msg.altitude,
                unit: msg.unit,
            };
            
            // since broadcast messages do not bring all information at once,
            // we compile all info together based on identity
            // the aircrafts array is kept in memory and saved into json file
            let index = identities.findIndex((identity) => identity === payload.identity);
            if (index === -1) {
                if (payload.icao !== '') {
                    identities.push(payload.identity);
                    aircrafts.push(
                        {
                            identity: payload.identity,
                        }
                    );
                    index = identities.length - 1; // only if there is an icao to avoid unknown details
                    aircrafts[index].icao = payload.icao;
                }
            }
            if (index !== -1) {
                aircrafts[index].date = Date.now();
                if (payload.callsign !== '') {
                    aircrafts[index].callsign = payload.callsign;
                }
                if (payload.aircraftType !== null) {
                    aircrafts[index].aircraftType = payload.aircraftType;
                }
                if (payload.rawLatitude !== null) {
                    aircrafts[index].rawLatitude = payload.rawLatitude;
                }
                if (payload.rawLongitude !== null) {
                    aircrafts[index].rawLongitude = payload.rawLongitude;
                }
                if (payload.speed !== null) {
                    aircrafts[index].speed = payload.speed;
                }
                if (payload.altitude !== null) {
                    aircrafts[index].altitude = payload.altitude;
                }
                if (payload.unit !== null) {
                    aircrafts[index].unit = payload.unit;
                }
                // fs.writeFileSync(file, JSON.stringify(aircrafts, null, 2)); //, (err) => { console.error(`Unable to append to file: ${file}`) });
                const a = aircrafts[index];
                if (a.callsign
                    && a.rawLatitude
                    && a.rawLongitude
                    && a.altitude) {
                    flight.insert(a);
                }
                
            }
        });
    },
    () => {},
    12,
    16 * 16384);
 