/**
 *  Modbus master example:
 *  The purpose of this example is to query several sets of data
 *  from an external Modbus slave device.
 *  The link media can be USB or RS232.
 *
 *  Recommended Modbus slave:
 *  diagslave http://www.modbusdriver.com/diagslave.html
 *
 *  In a Linux box, run
 *  "./diagslave /dev/ttyUSB0 -b 9600 -d 8 -s 1 -p none -m rtu -a 1"
 * 	This is:
 * 		serial port /dev/ttyUSB0 at 9600 baud 8N1
 *		RTU mode and address @1
 */
//SYSTEM_MODE(MANUAL); // no need for cell connection in this fw

#include <MQTT.h>
#include <OneWire.h>
#include "ModbusRtu.h"
#include "IEEE754.h"
#include "SparkDallasTemperature.h"

PRODUCT_ID(3416);
PRODUCT_VERSION(22);

/**
 * if want to use IP address,
 * byte server[] = { XXX,XXX,XXX,XXX };
 * MQTT client(server, 1883, callback);
 * want to use domain name,
 * MQTT client("www.sample.com", 1883, callback);
 **/

byte server[] = {200,40,153,99};
MQTT client(server, 1890, callbackMQTT);

DallasTemperature dallas(new OneWire(D1));  // Init Dallas on pin digital pin 1
uint16_t actpwr_au16data[2];                //!< data array for modbus network sharing
uint16_t actpwrp1_au16data[2];
uint16_t actpwrp2_au16data[2];
uint16_t actpwrp3_au16data[2];
uint16_t reapwr_au16data[2];
uint16_t reapwrp1_au16data[2];
uint16_t reapwrp2_au16data[2];
uint16_t reapwrp3_au16data[2];
uint16_t apppwr_au16data[2];
uint16_t apppwrp1_au16data[2];
uint16_t apppwrp2_au16data[2];
uint16_t apppwrp3_au16data[2];
uint16_t pwrfc_au16data[2];
uint16_t pwrfcp1_au16data[2];
uint16_t pwrfcp2_au16data[2];
uint16_t pwrfcp3_au16data[2];
uint16_t freq_au16data[2];
uint16_t temp_au16data[2];
uint16_t acten_au16data[4];
uint16_t actenp1_au16data[4];
uint16_t actenp2_au16data[4];
uint16_t actenp3_au16data[4];
uint16_t thdvl1n_au16data[2];
uint16_t thdvl2n_au16data[2];
uint16_t thdvl3n_au16data[2];
uint16_t actpwrpk_au16data[2];
uint16_t actenrtday_au16data[4];
uint8_t u8state;                            //!< machine state
uint8_t u8query;                            //!< pointer to message query

#define TXEN_PIN A3
#define RXEN_PIN A2
#define SLAVE_ONE           1
#define NAME_LENGTH         20
#define VALUE_LENGTH        2
#define ENERGY_LENGTH       4
#define REGISTER_READ       3
#define METER_NAME          30              //Schneider registers
#define ACT_PWR_P1          3054
#define ACT_PWR_P2          3056
#define ACT_PWR_P3          3058
#define ACTIVE_POWER        3060
#define REA_PWR_P1          3062
#define REA_PWR_P2          3064
#define REA_PWR_P3          3066
#define REACTIVE_POWER      3068
#define APP_PWR_P1          3070
#define APP_PWR_P2          3072
#define APP_PWR_P3          3074
#define APPARENT_POWER      3076
#define PWR_FC_P1           3078
#define PWR_FC_P2           3080
#define PWR_FC_P3           3082
#define POWER_FACTOR        3084
#define FREQUENCY           3110
#define TEMPERATURE         3132
#define ACTIVE_ENERGY       3204
#define ACT_EN_P1           3518
#define ACT_EN_P2           3522
#define ACT_EN_P3           3526
#define ACT_PWR_PK_DMND     3770
#define THD_V_L1_N          45120
#define THD_V_L2_N          45122
#define THD_V_L3_N          45124
#define RT_NRG_LOG_DAY      45605

/*
 *  Modbus object declaration
 *  u8id : node id = 0 for master, = 1..247 for slave
 *  u8serno : serial port (use 0 for Serial)
 *  u8txenpin : 0 for RS-232 and USB-FTDI
 *               or any pin number > 1 for RS-485
 *  u8rxenpin : 0 for RS-232 and USB-FTDI
 *               or any pin number > 1 for RS-485
 *  can be declared with just TXEN_PIN via:
 *        Modbus master(0, 1, TXEN_PIN);
 */
//Modbus master();                      // initiaization of master on serial 0
//Modbus master(0, 1);                  // initiaization using no TXEN or RXEN control
//Modbus master(0, 1, TXEN_PIN);        // initiaization using only TXEN control
Modbus master(0, 1, TXEN_PIN, RXEN_PIN);// 0=Master 1=Serial1 initiaization using independent RXEN and TXEN control

#define NUMBER_OF_QUERIES 2
modbus_t telegram[NUMBER_OF_QUERIES];
unsigned long u32wait, lastConnect, previous, particle_delay, wait = 5, wait_count = 0;
double PF, PF1, PF2, PF3, celsius, precelsius = 25;
char totals[255], phase1[255], phase2[255], phase3[255];

void callbackMQTT(char* topic, byte* payload, unsigned int length)
{
    //Function called when something is
    //received in the subscribed topic. 
    //There are no current subscriptions.
}

void setup()
{
    // telegram 0: read registers
    telegram[0].u8id = SLAVE_ONE;                 // slave address
    telegram[0].u8fct = REGISTER_READ;            // function code (this one is registers read)
    telegram[0].u16RegAdd = ACTIVE_POWER-1;       // start address in slave
    telegram[0].u16CoilsNo = VALUE_LENGTH;        // number of elements (coils or registers) to read
    telegram[0].au16reg = actpwr_au16data;        // pointer to a memory array in the Arduino
    // telegram 1: write a single register
    //telegram[1].u8id = 1;                       // slave address
    //telegram[1].u8fct = 6;                      // function code (this one is write a single register)
    //telegram[1].u16RegAdd = 2000;               // start address in slave
    //telegram[1].u16CoilsNo = 1;                 // number of elements (coils or registers) to read
    //telegram[1].au16reg = actpwr_au16data+2;    // pointer to a memory array in the Arduino
    master.begin(9600);                           // baud-rate at 9600
    master.setTimeOut(5000);                      // if there is no answer in 5000 ms, roll over
    u32wait = millis();
    u8state = u8query = 0;
    client.connect("Photon");
    dallas.begin();
}

void loop()
{
    previous = millis();
    if(!client.isConnected())
        client.connect("Photon");
    switch (u8state)
    {
        case 0:
        {
            if (millis()>u32wait)
                u8state++;                      // wait state
            break;
        }
        case 1:
        {
            master.query(telegram[u8query]);    // send query (only once)
            u8state++; 
    	    u8query = 0;
            break;
        }
        case 2:
        {
            master.poll();                      // check incoming messages
            if (master.getState()==COM_IDLE)
            {
                u8state = 0;
                u32wait = millis();
                switch (telegram[0].u16RegAdd)
                {
                    case ACTIVE_POWER-1:
                        {
                            telegram[0].u16RegAdd = ACT_PWR_P1-1;
                            telegram[0].au16reg = actpwrp1_au16data;
                            break;
                        }
                    case ACT_PWR_P1-1:
                        {
                            telegram[0].u16RegAdd = ACT_PWR_P2-1;
                            telegram[0].au16reg = actpwrp2_au16data;
                            break;
                        }
                    case ACT_PWR_P2-1:
                        {
                            telegram[0].u16RegAdd = ACT_PWR_P3-1;
                            telegram[0].au16reg = actpwrp3_au16data;
                            break;
                        }
                    case ACT_PWR_P3-1:
                        {
                            telegram[0].u16RegAdd = REACTIVE_POWER-1;
                            telegram[0].au16reg = reapwr_au16data;
                            break;
                        }    
                    case REACTIVE_POWER-1:
                        {
                            telegram[0].u16RegAdd = REA_PWR_P1-1;
                            telegram[0].au16reg = reapwrp1_au16data;
                            break;
                        }
                    case REA_PWR_P1-1:
                        {
                            telegram[0].u16RegAdd = REA_PWR_P2-1;
                            telegram[0].au16reg = reapwrp2_au16data;
                            break;
                        }
                    case REA_PWR_P2-1:
                        {
                            telegram[0].u16RegAdd = REA_PWR_P3-1;
                            telegram[0].au16reg = reapwrp3_au16data;
                            break;
                        }
                    case REA_PWR_P3-1:
                        {
                            telegram[0].u16RegAdd = APPARENT_POWER-1;
                            telegram[0].au16reg = apppwr_au16data;
                            break;
                        }
                    case APPARENT_POWER-1:
                        {
                            telegram[0].u16RegAdd = APP_PWR_P1-1;
                            telegram[0].au16reg = apppwrp1_au16data;
                            break;
                        }
                    case APP_PWR_P1-1:
                        {
                            telegram[0].u16RegAdd = APP_PWR_P2-1;
                            telegram[0].au16reg = apppwrp2_au16data;
                            break;
                        }
                    case APP_PWR_P2-1:
                        {
                            telegram[0].u16RegAdd = APP_PWR_P3-1;
                            telegram[0].au16reg = apppwrp3_au16data;
                            break;
                        }
                    case APP_PWR_P3-1:
                        {
                            telegram[0].u16RegAdd = POWER_FACTOR-1;
                            telegram[0].au16reg = pwrfc_au16data;
                            break;
                        }
                    case POWER_FACTOR-1:
                        {
                            if(msg2dbl(pwrfc_au16data)>1)
                                PF = 2 - msg2dbl(pwrfc_au16data);
                            else if(msg2dbl(pwrfc_au16data)<-1)
                                PF = -2 - msg2dbl(pwrfc_au16data);
                            else
                                PF = msg2dbl(pwrfc_au16data);
                            telegram[0].u16RegAdd = PWR_FC_P1-1;
                            telegram[0].au16reg = pwrfcp1_au16data;
                            break;
                        }
                    case PWR_FC_P1-1:
                        {
                            if(msg2dbl(pwrfcp1_au16data)>1)
                                PF1 = 2 - msg2dbl(pwrfcp1_au16data);
                            else if(msg2dbl(pwrfcp1_au16data)<-1)
                                PF1 = -2 - msg2dbl(pwrfcp1_au16data);
                            else
                                PF1 = msg2dbl(pwrfcp1_au16data);
                            telegram[0].u16RegAdd = PWR_FC_P2-1;
                            telegram[0].au16reg = pwrfcp2_au16data;
                            break;
                        }
                    case PWR_FC_P2-1:
                        {
                            if(msg2dbl(pwrfcp2_au16data)>1)
                                PF2 = 2 - msg2dbl(pwrfcp2_au16data);
                            else if(msg2dbl(pwrfcp2_au16data)<-1)
                                PF2 = -2 - msg2dbl(pwrfcp2_au16data);
                            else
                                PF2 = msg2dbl(pwrfcp2_au16data);
                            telegram[0].u16RegAdd = PWR_FC_P3-1;
                            telegram[0].au16reg = pwrfcp3_au16data;
                            break;
                        }
                    case PWR_FC_P3-1:
                        {
                            if(msg2dbl(pwrfcp3_au16data)>1)
                                PF3 = 2 - msg2dbl(pwrfcp3_au16data);
                            else if(msg2dbl(pwrfcp3_au16data)<-1)
                                PF3 = -2 - msg2dbl(pwrfcp3_au16data);
                            else
                                PF3 = msg2dbl(pwrfcp3_au16data);
                            telegram[0].u16RegAdd = FREQUENCY-1;
                            telegram[0].au16reg = freq_au16data;
                            break;
                        }
                    case FREQUENCY-1:
                        {
                            telegram[0].u16RegAdd = ACTIVE_ENERGY-1;
                            telegram[0].u16CoilsNo = ENERGY_LENGTH;
                            telegram[0].au16reg = acten_au16data;
                            break;
                        }
                    case ACTIVE_ENERGY-1:
                        {
                            telegram[0].u16RegAdd = ACT_EN_P1-1;
                            telegram[0].au16reg = actenp1_au16data;
                            break;
                        }
                    case ACT_EN_P1-1:
                        {
                            telegram[0].u16RegAdd = ACT_EN_P2-1;
                            telegram[0].au16reg = actenp2_au16data;
                            break;
                        }
                    case ACT_EN_P2-1:
                        {
                            telegram[0].u16RegAdd = ACT_EN_P3-1;
                            telegram[0].au16reg = actenp3_au16data;
                            break;
                        }
                    case ACT_EN_P3-1:
                        {
                            telegram[0].u16RegAdd = RT_NRG_LOG_DAY-1;
                            telegram[0].au16reg = actenrtday_au16data;
                            break;
                        }
                    case RT_NRG_LOG_DAY-1:
                        {
                            telegram[0].u16RegAdd = THD_V_L1_N-1;
                            telegram[0].u16CoilsNo = VALUE_LENGTH;
                            telegram[0].au16reg = thdvl1n_au16data;
                            break;
                        }    
                    case THD_V_L1_N-1:
                        {
                            telegram[0].u16RegAdd = THD_V_L2_N-1;
                            telegram[0].au16reg = thdvl2n_au16data;
                            break;    
                        }
                    case THD_V_L2_N-1:
                        {
                            telegram[0].u16RegAdd = THD_V_L3_N-1;
                            telegram[0].au16reg = thdvl3n_au16data;
                            break;    
                        }
                    case THD_V_L3_N-1:
                        {
                            telegram[0].u16RegAdd = ACT_PWR_PK_DMND-1;
                            telegram[0].au16reg = actpwrpk_au16data;
                            break;    
                        }
                    case ACT_PWR_PK_DMND-1:
                        {
                            telegram[0].u16RegAdd = TEMPERATURE-1;
                            telegram[0].au16reg = temp_au16data;
                            break;    
                        }
                    case TEMPERATURE-1:
                        {
                            telegram[0].u16RegAdd = ACTIVE_POWER-1;
                            telegram[0].au16reg = actpwr_au16data;
                            dallas.requestTemperatures();
                            celsius = dallas.getTempCByIndex(0);
                            if(celsius == -127)
                                celsius = precelsius;
                            precelsius = celsius;
                            particle_delay = wait*1000-(millis()-previous);
                            delay(particle_delay);
                            snprintf(totals, sizeof(totals), "{\"coreid\":\"%s\",\"actpwr\":%f,\"reapwr\":%f,\"apppwr\":%f,\"pwrfc\":%f,\"freq\":%f,\"acten\":%u,\"actenrtday\":%u,\"actpwrpk\":%f,\"temp\":%f,\"celsius\":%f}", Particle.deviceID().c_str(), msg2dbl(actpwr_au16data), msg2dbl(reapwr_au16data), msg2dbl(apppwr_au16data), PF, msg2dbl(freq_au16data), acten_au16data[0]*281474976710656+acten_au16data[1]*4294967296+acten_au16data[2]*65536+acten_au16data[3], actenrtday_au16data[0]*281474976710656+actenrtday_au16data[1]*4294967296+actenrtday_au16data[2]*65536+actenrtday_au16data[3], msg2dbl(actpwrpk_au16data), msg2dbl(temp_au16data), celsius);
                            client.publish("fromEventHubTotals", totals);
                            snprintf(phase1, sizeof(phase1), "{\"coreid\":\"%s\",\"actpwrp1\":\"%f\",\"reapwrp1\":\"%f\",\"apppwrp1\":\"%f\",\"pwrfcp1\":\"%f\",\"actenp1\":\"%f\",\"thdvl1n\":\"%f\"}", Particle.deviceID().c_str(), msg2dbl(actpwrp1_au16data), msg2dbl(reapwrp1_au16data), msg2dbl(apppwrp1_au16data), PF1, actenp1_au16data[0]*281474976710656+actenp1_au16data[1]*4294967296+actenp1_au16data[2]*65536+actenp1_au16data[3], msg2dbl(thdvl1n_au16data));
                            client.publish("fromEventHubPhase1", phase1);
                            snprintf(phase2, sizeof(phase2), "{\"coreid\":\"%s\",\"actpwrp2\":\"%f\",\"reapwrp2\":\"%f\",\"apppwrp2\":\"%f\",\"pwrfcp2\":\"%f\",\"actenp2\":\"%f\",\"thdvl2n\":\"%f\"}", Particle.deviceID().c_str(), msg2dbl(actpwrp2_au16data), msg2dbl(reapwrp2_au16data), msg2dbl(apppwrp2_au16data), PF2, actenp2_au16data[0]*281474976710656+actenp2_au16data[1]*4294967296+actenp2_au16data[2]*65536+actenp2_au16data[3], msg2dbl(thdvl2n_au16data));
                            client.publish("fromEventHubPhase2", phase2);
                            snprintf(phase3, sizeof(phase3), "{\"coreid\":\"%s\",\"actpwrp3\":\"%f\",\"reapwrp3\":\"%f\",\"apppwrp3\":\"%f\",\"pwrfcp3\":\"%f\",\"actenp3\":\"%f\",\"thdvl3n\":\"%f\"}", Particle.deviceID().c_str(), msg2dbl(actpwrp3_au16data), msg2dbl(reapwrp3_au16data), msg2dbl(apppwrp3_au16data), PF3, actenp3_au16data[0]*281474976710656+actenp3_au16data[1]*4294967296+actenp3_au16data[2]*65536+actenp3_au16data[3], msg2dbl(thdvl3n_au16data));
                            client.publish("fromEventHubPhase3", phase3);
                            wait_count += wait;
                            if(wait_count == 300)
                            {
                                //Missing real time active energy per day, per phase and power demand information.
                                Particle.publish("fromMetersTotals", totals, PRIVATE);
                                Particle.publish("fromMetersPhase1", phase1, PRIVATE);
                                Particle.publish("fromMetersPhase2", phase2, PRIVATE);
                                Particle.publish("fromMetersPhase3", phase3, PRIVATE);
                                wait_count = 0;
                            }
                            break;    
                        }
                    default:
                        break;
                }
            }
            break;
        }
    }
}