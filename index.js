'use strict';
require('ts-node/register');

var config = require('./config.json');
if (!config.tables || !config.cloud){
    console.log("tables or cloud are not configured!");
    process.exit(1);
}

var rcc = require('./rcc').getInstance(config.cloud.baseurl,config.cloud.appid,config.cloud.appsecret);
var iconv = require('iconv-lite');

//keep heartBeat every minute
function heartBeat(){
    rcc.heartBeat((err)=>{
        setTimeout(heartBeat,60000);
    });
}
heartBeat();

//scan ms sql server and send records to cloud
let queryStr = "";
for(let i=0;i<config.tables.length;i++){
    queryStr += 'select * from ' + config.tables[i].name + ';'
}

const sql = require('mssql');
sql.on('error', console.error);

sql.connect(config).then(pool =>{
    console.log("connect ms sql successfully!");
    async function scan(){
        try{
            let result = await pool.request().query(queryStr); 
            //make MachineNumber unique if there are more than 1 dtr in dying factory
            for(let i=0;i<config.tables.length;i++){
                result.recordsets[i].forEach(record => {
                    record.MachineNumber += config.tables[i].base;
                    config.charFields.forEach(field => {                       
                        let buffer = new Buffer(record[field], "binary");
                        record[field] = iconv.decode(buffer,config.tables[i].encoding).trim();               
                    });                    
                });                
            }

            //join records together
            let records = [];
            records = records.concat(...result.recordsets); 
            //console.log(JSON.stringify(records)); 

            //only online machines or machines with assigned name to be useful
            records = records.filter(record => {return record.OnLine || (record.MachineName && record.MachineName.length>0)});            
            
            if (records.length > 0){
                //send to cloud
                rcc.sendEvent(records,(err)=>{
                    if (err){
                        console.error(JSON.stringify(err));
                    }
                });   
            }                    
        }catch(err){
            console.error(JSON.stringify(err));
        }    
        setTimeout(scan,30000);          
    }
    scan();
}).catch(console.error);

