var ws = require('nodejs-websocket');
var DocumentClient = require("documentdb").DocumentClient;

process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node NOT Exiting...");
}); 

//COMIENZO CONFIGURACIÓN PARA DOCUMENTDB
var config = {};
config.endpoint = "https://schneider-db.documents.azure.com:443/";
config.primaryKey = "w1TSC5QXbF9Simwl1PQWpAKWXhats94z5mXcvdXdlFhfObn12v0VQtZv1Mdm5f2wFrf4W5pizqBAFgPrNhd5Fw==";

// ADD THIS PART TO YOUR CODE
config.database = {
    "id": "SchneiderDBPiso19"
};

config.collection = {
    "id": "SchneiderFloat"};

var irigoyen = "2e0028000a47353138383138";
var tacuari = "310036001047353138383138";

var client = new DocumentClient(config.endpoint, { "masterKey": config.primaryKey });
// ADD THIS PART TO YOUR CODE
var HttpStatusCodes = { NOTFOUND: 404 };
var databaseUrl = `dbs/${config.database.id}`;
var collectionUrl = `${databaseUrl}/colls/${config.collection.id}`;
//FIN CONFIGURACIÓN PARA DOCUMENTDB

var wsServer = ws.createServer();
wsServer.listen(8003);

wsServer.on('connection', function(conn){
    console.log("New connection");
    conn.on("text", function (str) {
        var data = JSON.parse(str);
        var consulta = new Consulta(data.dateFrom, data.dateTo, data.coreId, data.phase);
        		console.log(consulta);
        var response = new Object();
        switch(data.query)
        {
        	case "initialData":
        		consulta.getMinActiveEnergyByCoreIdAndPhase("", "Totals", function(result){
        			response.data = new Object();
        			response.data.Totals = result;
        			consulta.getMinActiveEnergyByCoreIdAndPhase(irigoyen, "Totals", function(result0){
        				response.data.Irigoyen = new Object();
        				response.data.Irigoyen.Totals = result0;
        				consulta.getMinActiveEnergyByCoreIdAndPhase(irigoyen, "One", function(result1){
	        				response.data.Irigoyen.Phase1 = result1;
	        				consulta.getMinActiveEnergyByCoreIdAndPhase(irigoyen, "Two", function(result2){
		        				response.data.Irigoyen.Phase2 = result2;
		        				consulta.getMinActiveEnergyByCoreIdAndPhase(irigoyen, "Three", function(result3){
			        				response.data.Irigoyen.Phase3 = result3;
			        				consulta.getMinActiveEnergyByCoreIdAndPhase(tacuari, "Totals", function(result4){
				        				response.data.Tacuari = new Object();
				        				response.data.Tacuari.Totals = result4;
				        				consulta.getMinActiveEnergyByCoreIdAndPhase(tacuari, "One", function(result5){
					        				response.data.Tacuari.Phase1 = result5;
					        				consulta.getMinActiveEnergyByCoreIdAndPhase(tacuari, "Two", function(result6){
						        				response.data.Tacuari.Phase2 = result6;
						        				consulta.getMinActiveEnergyByCoreIdAndPhase(tacuari, "Three", function(result7){
							        				response.data.Tacuari.Phase3 = result7;
							        				response.type = data.query;
							        				console.log(response.data)
							        				broadcast(response);
						        				})
					        				})
				        				})
				        			})
		        				})
	        				})
        				})
        			})
        		})
        		break;
        	case "costo":
        		if (consulta.coreId == "" && consulta.phase == "Totals")
        		{
        			consulta.getRealActiveEnergyByCoreIdAndPhase(irigoyen, "Totals", function(result){
	        			response.type = data.query;
	        			consulta.getActivePowerPeak(consulta.coreId, function(resultado){
	        			response.data = parseFloat(consulta.calculateCost(result, resultado, irigoyen, "Totals"));
	        			consulta.getRealActiveEnergyByCoreIdAndPhase(tacuari, "Totals", function(result1){
		        			consulta.getActivePowerPeak(consulta.coreId, function(resultado1){
		        			response.data += parseFloat(consulta.calculateCost(result1, resultado1, tacuari, "Totals"));
		        			broadcast(response);

		        			});
	        			});

	        			});
        			});
        		}
        		else
        		{
        			consulta.getRealActiveEnergyByCoreIdAndPhase(consulta.coreId, consulta.phase, function(result){
						console.log("Active Energy " + result);
	        			response.type = data.query;
	        			consulta.getActivePowerPeak(consulta.coreId, function(resultado){
	        			response.data = consulta.calculateCost(result, resultado, consulta.coreId, consulta.phase);
	        			broadcast(response);

	        			});
        			});
        		}
        		break;
            case "entreFechas":
                if (consulta.coreId == ""){
                    consulta.getMaxMinAndAvg(function(result){
                    	response.type = data.query;
                    	response.data = result;
                    	console.log(response.data);
                        broadcast(response);
                    });
                }
                else{
                    consulta.getMaxMinAndAvgByCoreIdAndPhase(function(result){
                    	response.type = data.query;
                    	response.data = result;
                        broadcast(response);
                    });
                }
                break;
            case "consumoMes":
                if (consulta.coreId == ""){
                    consulta.getRealActiveEnergyTotal(function(result){
                    	response.type = data.query;
                    	response.data = result;
                        broadcast(response);
                    });
                }
                else{
                    consulta.getRealActiveEnergyByCoreIdAndPhase(consulta.coreId, consulta.phase, function(result){
                    	response.type = data.query;
                    	response.data = result;
                        broadcast(response);
                    });
                }
                break;

        }
    });
});

wsServer.on('error', function(errObj){
    console.log("Error Web Socket");
});

wsServer.on('close', function(){
    console.log("Close Web Socket. Retrying...");
    wsServer.listen(8003);
});

function broadcast(msg) {
    wsServer.connections.forEach(function (conn) {
        conn.sendText(JSON.stringify(msg));
    });
}  

function executeQuery(myQuerySpec, callback){
      client.queryDocuments(collectionUrl, myQuerySpec, {enableScanInQuery: true}).toArray(function (err, results) {
            if (err) {
                console.log("Error");
            }
            else if (results.length == 0) {
                console.log("No documents found matching");
                callback(null)
            } 
            else
            {
                callback(results[0]);
            }
        });
}

function getInitialData(coreId){
   	 today = new Date();
   	 dateFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate());
   	 dateTo = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 15);

	 var returnValue = {};
	 returnValue.tacuari = {};
	 returnValue.irigoyen = {};

	 var query = {
                    query: `SELECT TOP 1
                             c.activeenergy activeenergy
                            FROM c WHERE c.published_at >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = "Totals" order by c.activeenergy asc`,
                    parameters:[
                        {
                            name:'@dateFrom',
                            value: dateFrom
                         },
                        {
                            name:'@dateTo',
                            value: dateTo
                        },
                        {
                            name:'@coreId',
                            value: coreId
                        }
                    ]
                };
    executeQuery(querySpecTo, function(result){
    	returnValue.totals = result;
    	query = {
	                query: `SELECT TOP 1
	                         c.activeenergy activeenergy
	                        FROM c WHERE c.published_at >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = "Phase1" order by c.activeenergy asc`,
	                parameters:[
	                    {
	                        name:'@dateFrom',
	                        value: dateFrom
	                     },
	                    {
	                        name:'@dateTo',
	                        value: dateTo
	                    },
	                    {
	                        name:'@coreId',
	                        value: coreId
	                    }
	                ]
	            };
        executeQuery(querySpecTo, function(result){
        	returnValue.phase1 = result;
        	query = {
		                query: `SELECT TOP 1
		                         c.activeenergy activeenergy
		                        FROM c WHERE c.published_at >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = "Phase2" order by c.activeenergy asc`,
		                parameters:[
		                    {
		                        name:'@dateFrom',
		                        value: dateFrom
		                     },
		                    {
		                        name:'@dateTo',
		                        value: dateTo
		                    },
		                    {
		                        name:'@coreId',
		                        value: coreId
		                    }
		                ]
		            };
        	executeQuery(querySpecTo, function(result){
        		returnValue.phase2 = result;
        		query = {
			                query: `SELECT TOP 1
			                         c.activeenergy activeenergy
			                        FROM c WHERE c.published_at >= @dateFrom AND c.published_at <= @dateTo AND c.coreid=@coreId AND c.eventname = "Phase3" order by c.activeenergy asc`,
			                parameters:[
			                    {
			                        name:'@dateFrom',
			                        value: dateFrom
			                     },
			                    {
			                        name:'@dateTo',
			                        value: dateTo
			                    },
			                    {
			                        name:'@coreId',
			                        value: coreId
			                    }
			                ]
			            };
	        	executeQuery(querySpecTo, function(result){
	        		returnValue.phase3 = result;
	        		broadcast(JSON.stringify(returnValue));
	        	});


        	});
        });
    });

}

// ====================================================================================== START CONSULTA ===================================================================================

class Consulta{

	constructor(dateFrom, dateTo, coreId, phase){
       	this.dateFrom = dateFrom;
		this.dateTo = dateTo;
    	this.coreId = coreId;
    	this.phase = phase;
    }


    getMinActiveEnergyByCoreIdAndPhase(coreId, phase, callback){
		var me = this;
		var querySpec = new Object();
		if (coreId == ""){
			var toQuery =  `SELECT min(c.activeenergy) activeenergy
	                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid <> "api" AND c.eventname = @eventName order by c.activeenergy desc`;
		}
		else{
			var toQuery =  `SELECT min(c.activeenergy) activeenergy
	                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = @eventName order by c.activeenergy desc`;
		}
	    querySpec = {
	                        query: toQuery,
	                        parameters:[
	                            {
	                                name:'@dateFrom',
	                                value: me.dateFrom
	                             },
	                            {
	                                name:'@dateTo',
	                                value: me.dateTo
	                            },
	                            {
	                                name:'@coreId',
	                                value: coreId
	                            },
	                            {
	                                name:'@eventName',
	                                value: phase
	                            }
	                        ]
	                    };
	    executeQuery(querySpec, function(result){
	    	callback(result.activeenergy);
	    });
	}

    getRealActiveEnergyByCoreIdAndPhase(coreId, phase, callback){
		var me = this;
		var querySpecTo = new Object();
		if (coreId == ""){
			var toQuery =  `SELECT TOP 1
	                                c.activeenergy activeenergy
	                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid <> "api" AND c.eventname = @eventName order by c.activeenergy desc`;
		}
		else{
			var toQuery =  `SELECT TOP 1
	                                c.activeenergy activeenergy
	                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = @eventName order by c.activeenergy desc`;
		}
	    querySpecTo = {
	                        query: toQuery,
	                        parameters:[
	                            {
	                                name:'@dateFrom',
	                                value: me.dateFrom
	                             },
	                            {
	                                name:'@dateTo',
	                                value: me.dateTo
	                            },
	                            {
	                                name:'@coreId',
	                                value: coreId
	                            },
	                            {
	                                name:'@eventName',
	                                value: phase
	                            }
	                        ]
	                    };
	    executeQuery(querySpecTo, function(result){
	    	console.log("To " + JSON.stringify(result))
	     	var activeEnergyTo = result == null ? 0 : result.activeenergy;
	     	console.log(activeEnergyTo)
	     	if (coreId == ""){
				var fromQuery =  `SELECT TOP 1
		                                c.activeenergy activeenergy
		                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid <> "api" AND c.eventname = @eventName order by c.activeenergy asc`;
			}
			else{
				var fromQuery =  `SELECT TOP 1
		                                c.activeenergy activeenergy
		                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = @eventName order by c.activeenergy asc`;
			}
	        var querySpecFrom = {
	                        query: fromQuery,
	                        parameters:[
	                            {
	                                name:'@dateFrom',
	                                value: me.dateFrom
	                             },
	                            {
	                                name:'@dateTo',
	                                value: me.dateTo
	                            },
	                            {
	                                name:'@coreId',
	                                value: coreId
	                            },
	                            {
	                                name:'@eventName',
	                                value: phase
	                            }
	                        ]
	                    };  
	        executeQuery(querySpecFrom, function(result){
	    	console.log("From " + JSON.stringify(result))
	            var activeEnergyFrom = result == null ? 0 : result.activeenergy;
	            callback(activeEnergyTo-activeEnergyFrom);
	        }); 
	    
	    });
	}

	getRealActiveEnergyTotal(callback){
		var me = this;
	    me.getRealActiveEnergyByCoreId("2e0028000a47353138383138", "Totals", function(result){

	        var total = result;
	        me.getRealActiveEnergyByCoreId("310036001047353138383138", "Totals", function(res){
	            total += res
	            callback(total);
	        });
	    });
	}

	getMaxMinAndAvgByCoreIdAndPhase(callback){
		var me = this
	    var querySpec = {
	                    query: `SELECT
	                                max(c.activeenergy) maxActiveEnergy,
	                                min(c.powerfactor) minPowerFactor,
	                                max(c.apparentpower) maxApparentPower,
	                                min(c.reactivepower) minReactivePower,
	                                max(c.activepower) maxActivePower
	                            FROM c WHERE c.published_at >= @dateFrom AND c.published_at <= @dateTo and c.coreid=@coreId and c.eventname = @eventName`,
	                    parameters:[
	                        {
	                            name:'@dateFrom',
	                            value: me.dateFrom
	                         },
	                        {
	                            name:'@dateTo',
	                            value: me.dateTo
	                        },
	                        {
	                            name:'@coreId',
	                            value: me.coreId
	                        },
	                        {
	                            name:'@eventName',
	                            value: me.phase
	                        }
	                    ]
	                };

	    executeQuery(querySpec, function(result){
	        callback(result);
	    });
	}

	getMaxMinAndAvgTotals(callback){
		var me = this;
	    var querySpec = {
	                    query: `SELECT
	                                max(c.activeenergy) maxActiveEnergy,
	                                avg(c.frequency) avgFrequency,
	                                min(c.powerfactor) minPowerFactor,
	                                max(c.apparentpower) maxApparentPower,
	                                min(c.reactivepower) minReactivePower,
	                                max(c.activepower) maxActivePower
	                            FROM c WHERE c.published_at >= @dateFrom AND c.published_at <= @dateTo AND c.coreid <> "api" and c.eventname = "Totals"`,
	                    parameters:[
	                        {
	                            name:'@dateFrom',
	                            value: me.dateFrom
	                         },
	                        {
	                            name:'@dateTo',
	                            value: me.dateTo
	                        }
	                    ]
	                };

	    executeQuery(querySpec, function(result){
	        callback(result);
	    });
	}


	getActivePowerPeak(coreId, callback){
	    var me = this;
		var querySpec = new Object();
		if (coreId == ""){
			var aQuery =  `SELECT
	                                max(c.activepowerdemandpeak) activepowerdemandpeak
	                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid <> "api" AND c.eventname = "Totals" order by c.activeenergy desc`;
		}
		else{
			var aQuery =  `SELECT TOP 1
	                                c.activepowerdemandpeak activepowerdemandpeak
	                                FROM c WHERE c.time >= @dateFrom AND c.time <= @dateTo AND c.coreid=@coreId AND c.eventname = "Totals" order by c.activeenergy desc`;
		}
	    querySpec = {
	                        query: aQuery,
	                        parameters:[
	                            {
	                                name:'@dateFrom',
	                                value: me.dateFrom
	                             },
	                            {
	                                name:'@dateTo',
	                                value: me.dateTo
	                            },
	                            {
	                                name:'@coreId',
	                                value: coreId
	                            }
	                        ]
	                    };
	    executeQuery(querySpec, function(result){
	    	callback(result.activepowerdemandpeak);
	    });
	}

	calculateCost(activeEnergy, activePowerPeak, coreid, phase){
		var phaseDivide = 1;
		var coreDivide = 1;
		console.log("phase: " + phase)
		console.log("coreid: " + coreid)
		if (phase != "Totals")
			phaseDivide = 3;
		if (coreid != "")
			coreDivide = 2
		console.log("1.36383 * [471.24 / " + (phaseDivide * coreDivide) + " + 170.82 * 25 / " + (phaseDivide * coreDivide) + " + (3.28 * " + activePowerPeak + "/ " + phaseDivide + ") + (3.6 * " + activeEnergy + " / 1000000)  + (0.731 * " + activeEnergy + "/ 1000) + 256.23 * (" + activePowerPeak + " / " + phaseDivide + " - 25 / " + (phaseDivide * coreDivide) + ")]");
		var cost = 471.24 / (phaseDivide * coreDivide) + 170.82 * 25 / (phaseDivide * coreDivide) + (3.28 * activePowerPeak / phaseDivide) + (3.6 * activeEnergy / 1000000)  + (0.731 * activeEnergy / 1000) + 256.23 * (activePowerPeak / phaseDivide  - 25 / (phaseDivide * coreDivide));	
	    cost *= 1.36383;
	    cost = cost.toFixed(2);
	    return cost;
	}
}

// ============================================================== END CONSULTA ==============================================================

