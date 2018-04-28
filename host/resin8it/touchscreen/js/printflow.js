var printStatus = "";
var jobId="";
var runningjobName="";
var totalslices=0;
var currentslice=0;
var elapsedtime=0;
var starttime=0;
var averageslicetime=0;
var signalstrength = -100;
var PRINTERONIMAGE = "images/printer-on.png";
var PRINTEROFFIMAGE = "images/printer-off.png";
            
function startpage(){
        if (typeof Cookies.get('lastwifi') !== 'undefined'){
                signalstrength = Cookies.get('lastwifi');
                if (signalstrength > -45) {
                        document.getElementById("wifi").src="images/wifi-3.png";
                }
                else if (signalstrength > -67) {
                        document.getElementById("wifi").src="images/wifi-2.png";
                }
                else if (signalstrength > -72) {
                        document.getElementById("wifi").src="images/wifi-1.png";
                }
                else if (signalstrength > -80) {
                        document.getElementById("wifi").src="images/wifi-0.png";
                }
                else document.getElementById("wifi").src="images/wifi-nc.png";
        }
        else{
                wifiupdate();
        }
        
        setInterval(function() {
                //wifi updating
                wifiupdate();    
	}, 3000);
}

function printerStatus(){
        if (document.getElementById("printerstatus").src.indexOf("midchange") == -1){
                $.getJSON("/services/printers/get/"+encodeURI(printerName)).done(function (data){
                        if (data.started)
                        {
                                Cookies.set('printerstatus',PRINTERONIMAGE);
                                document.getElementById("printerstatus").src = PRINTERONIMAGE;
                        }
                        else
                        {
                                Cookies.set('printerstatus',PRINTEROFFIMAGE);
                                document.getElementById("printerstatus").src = PRINTEROFFIMAGE;
                        }
                });
        }
}


function wifiupdate(){
	//TODO: JSON to query the server's wifi status and display it
        
        $.getJSON("../services/machine/wirelessNetworks/getWirelessStrength")
        .done(function (data){
		if ((typeof data !== 'undefined')&&(data !== null)){
			signalstrength = parseInt(data);
		}
                else{
                        signalstrength = -100;
                }
	});
        Cookies.set('lastwifi',signalstrength);
        
	// in the meantime for testing purposes, choose a random number.
	// signalstrength = Math.floor(Math.random() * -60)-30; //signal strength in dBm
        
        //using this as a guide for decent signal strengths in dBm: https://support.metageek.com/hc/en-us/articles/201955754-Understanding-WiFi-Signal-Strength
        if (signalstrength > -45) {
		wifiurl="images/wifi-3.png";
        }
        else if (signalstrength > -67) {
                wifiurl="images/wifi-2.png";
        }
        else if (signalstrength > -72) {
                wifiurl="images/wifi-1.png";
        }
        else if (signalstrength > -80) {
                wifiurl="images/wifi-0.png";
        }
        else wifiurl="images/wifi-nc.png";

	document.getElementById("wifi").src = wifiurl;
}
            


function urlParam (name){
	var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
	if ((results !== null)&&(results[1] !== null)){
        	return results[1];
    	}
	else{
		return null;
	}
}