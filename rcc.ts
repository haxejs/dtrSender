import * as rest from "restler";

class RCC{
  private token:{id:string,ttl:number,startTime:number,userId:string|number} = null;
  private rcc_url = "http://localhost:3000/api";
  private static instance:RCC = null;
  public static getInstance(baseurl:string, appid:string, appsecret:string){
    if (RCC.instance===null){
      RCC.instance = new RCC(appid,appsecret);
      RCC.instance.setBaseUrl(baseurl);
    }
    return RCC.instance;
  }

  constructor(private appid:string,private appsecret:string){
  }

  public setBaseUrl(url:string){
    this.rcc_url = url;
  }

  private _validateToken(callback:Function){
    if (!this.token){
      this._requestToken(callback);
    }else {
      var currentTime = new Date().getTime();
      if (currentTime - this.token.startTime < this.token.ttl - 2000){
        callback();
      }else{
        this._requestToken(callback);
      }
    }
  }

  private _requestToken(callback:Function){
    var self = this;
    rest.post(self.rcc_url+"/Customers/login", {
      data: {email:this.appid,password:this.appsecret},
    }).on('complete', function(data, response) {
      if (!(data instanceof Error) && (response.statusCode == 200)) {
        var startTime = new Date().getTime();
        self.token = data;
        self.token.startTime = startTime;
        callback(null,data);
      }else{
        callback(data);
      }
    });
  }

  private _requestByPost(url,data,callback:Function){
    var self = this;
    var mOptions = {headers:{Authorization:self.token.id}};

    rest.postJson(url,data,mOptions).on('success', function(data, response) {
      callback(null,data);
    }).on('fail', function(data, response) {
      if (response.statusCode===401){//invalidate token if AUTHORIZATION_REQUIRED
        self.token = null;
      }
      callback(data,response);
    }).on('error', function(err,response) {
      callback(err,response);
    }).on('abort', function() {
      callback(new Error("aborted"));
    }).on('timeout', function(ms) {
      callback(new Error("timeout[ms]:"+ms));
    });
  }

  private _requestByPut(url,data,callback:Function){
    var self = this;
    var mOptions = {headers:{Authorization:self.token.id}};

    rest.putJson(url,data,mOptions).on('success', function(data, response) {
      callback(null,data);
    }).on('fail', function(data, response) {
      if (response.statusCode===401){//invalidate token if AUTHORIZATION_REQUIRED
        self.token = null;
      }
      callback(data,response);
    }).on('error', function(err,response) {
      callback(err,response);
    }).on('abort', function() {
      callback(new Error("aborted"));
    }).on('timeout', function(ms) {
      callback(new Error("timeout[ms]:"+ms));
    });
  }


  public sendEvent(payload:any,callback:Function){
    var self = this;
    self._validateToken(function(err){
      if (err) return callback(err);
      self._requestByPost(self.rcc_url+"/Events",payload,callback);
    });
  }

  public heartBeat(callback:Function){
    var self = this;
    self._validateToken(function(err){
      if (err) return callback(err);
      self._requestByPut(self.rcc_url+"/Customers/"+self.token.userId+"/heartBeat",{},callback);
    });
  }

}

export = RCC;