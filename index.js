'use strict';
require('ts-node/register');

var config = require('./config.json');
if (!config.tables || !config.cloud){
    console.log("tables or cloud are not configured!");
    process.exit(1);
}

var rcc = require('./rcc').getInstance(config.cloud.baseurl,config.cloud.appid,config.cloud.appsecret);
const sql = require('mssql');
sql.on('error', console.error);

let queryStr = "";
for(let i=0;i<config.tables.length;i++){
    queryStr += 'select * from ' + config.tables[i].name + ';'
}

sql.connect(config).then(pool =>{
    async function scan(){
        try{
            let result = await pool.request().query(queryStr); 
            let events = [];
            events = events.concat(...result.recordsets);

            if (events.length !== config.tables.length*64){
                console.log('the num of records is not correct');
                return setTimeout(scan,10000);//try again,will DTR batch insert/update?
            }
            events = events.filter(event => {return event.OnLine});//only online machines

            console.log(JSON.stringify(events));
            //send to cloud
            rcc.sendEvent(events,(err)=>{
                if (err){
                    console.error(JSON.stringify(err));
                    rcc.sendEvent(events,(err)=>{if(err) console.error(JSON.stringify(err));});
                }
            });           
        }catch(err){
            console.error(JSON.stringify(err));
        }    
        setTimeout(scan,30000);          
    }
    scan();    
}).catch(console.error);

