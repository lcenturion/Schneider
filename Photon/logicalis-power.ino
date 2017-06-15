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
PRODUCT_VERSION(15);

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
uint16_t reapwr_au16data[2];
uint16_t apppwr_au16data[2];
uint16_t pwrfc_au16data[2];
uint16_t freq_au16data[2];
uint16_t temp_au16data[2];
uint16_t acten_au16data[4];
uint16_t thdvl1n_au16data[2];
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
#define ACTIVE_POWER        3060
#define REACTIVE_POWER      3068
#define APPARENT_POWER      3076
#define POWER_FACTOR        3084
#define FREQUENCY           3110
#define TEMPERATURE         3132
#define ACTIVE_ENERGY       3204
#define THD_V_L1_N          45120

/**
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
unsigned long u32wait, previous, delay, wait = 5, wait_count = 0;
double PF, celsius, precelsius = 25;
char payload[255];

void callbackMQTT(char* topic, byte* payload, unsigned int length)
{
    //Function called when something is received
    //in the subscribed topic.
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
    Serial.begin(9600);
    dallas.begin();
    client.connect("Photon");
    Serial.println();
}

void loop()
{
    previous = millis();
    if(!client.loop())
    {
        client.connect("Photon");
        Serial.println();
    }
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
                            telegram[0].u16RegAdd = REACTIVE_POWER-1;
                            telegram[0].au16reg = reapwr_au16data;
                            break;
                        }
                    case REACTIVE_POWER-1:
                        {
                            telegram[0].u16RegAdd = APPARENT_POWER-1;
                            telegram[0].au16reg = apppwr_au16data;
                            break;
                        }
                    case APPARENT_POWER-1:
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
                            telegram[0].u16RegAdd = THD_V_L1_N-1;
                            telegram[0].u16CoilsNo = VALUE_LENGTH;
                            telegram[0].au16reg = thdvl1n_au16data;
                            break;
                        }
                    case THD_V_L1_N-1:
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
                            snprintf(payload, sizeof(payload), "{\"actpwr\":%f,\"reapwr\":%f,\"apppwr\":%f,\"pwrfc\":%f,\"freq\":%f,\"acten\":%u,\"thdvl1n\":%f,\"temp\":%f,\"celsius\":%f}", msg2dbl(actpwr_au16data), msg2dbl(reapwr_au16data), msg2dbl(apppwr_au16data), PF, msg2dbl(freq_au16data), acten_au16data[0]*281474976710656+acten_au16data[1]*4294967296+acten_au16data[2]*65536+acten_au16data[3], msg2dbl(thdvl1n_au16data), msg2dbl(temp_au16data), celsius);
                            delay = wait*1000-(millis()-previous);
                            delay(delay);
                            client.publish("fromEventHub", payload);
                            wait_count += wait;
                            if(wait_count == 900)
                            {
                                Particle.publish("fromMeters", payload, PRIVATE);
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