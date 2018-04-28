(function() {
	var cwhApp = angular.module('cwhApp');
	cwhApp.controller("SettingsController", ['$scope', '$http', '$location', '$anchorScroll', '$routeParams', '$uibModal', '$interval', 'cwhWebSocket', 'photonicUtils', function ($scope, $http, $location, $anchorScroll, $routeParams, $uibModal, $interval, cwhWebSocket, photonicUtils) {
		controller = this;
		var timeoutValue = 500;
		var maxUnmatchedPings = 3;//Maximum number of pings before we assume that we lost our connection
		var unmatchedPing = -1;    //Number of pings left until we lose our connection
		$scope.showAdvanced = false;
		var thankYouMessage = " Thank you for unplugging the network cable. This configuration process could take a few minutes to complete. You can close your browser now and use the Photonic3D Client to find your printer.";
		this.loadingNetworksMessage = "--- Loading wifi networks from server ---"
		
		var PRINTERS_DIRECTORY = "printers";
		var BRANCH = "master";
		var REPO = $scope.repo;
		
		var tempSLicingProfile;
		
		this.loadingFontsMessage = "--- Loading fonts from server ---"
		this.loadingProfilesMessage = "--- Loading slicing profiles from server ---"
		this.loadingMachineConfigMessage = "--- Loading machine configurations from server ---"
		this.autodirect = $location.search().autodirect;
		
		this.toggleAdvanced = function toggleAdvanced(){
			$scope.showAdvanced = !$scope.showAdvanced;
		}
		
		this.getAdvanced = function getAdvanced(){
			return showAdvanced;
		}
		
		function refreshSelectedPrinter(printerList) {
        	var foundPrinter = false;
        	if (printerList.length == 1 &&  controller.autodirect != 'disabled') {
        		controller.currentPrinter = printerList[0];
        		foundPrinter = true;
        	} else {
        		var printersStarted = 0;
        		var currPrinter = null;
	        	for (var i = 0; i < printerList.length; i++) {
				// had to change as for ___ of ____ isn't supported in IE11 :(
	        		if (printersStarted > 1) {
	        			break;
	        		}
	        		if (printerList[i].started) {
	        			printersStarted += 1;
	        			currPrinter = printerList[i];
	        		}
	        		if (controller.currentPrinter != null && printerList[i].configuration.name === controller.currentPrinter.configuration.name) {
	        			controller.currentPrinter = printerList[i];
	        			foundPrinter = true;
	        		}
	        	}
	        	if (printersStarted == 1 && controller.autodirect != 'disabled') {
	        		controller.currentPrinter = currPrinter;
	        		foundPrinter = true;
	        	}
        	}
        	if (!foundPrinter) {
        		controller.currentPrinter = null;
        	}
        }
		
		function refreshPrinters() {
	        $http.get('/services/printers/list').success(function(data) {
	        	$scope.printers = data;
	        	refreshSelectedPrinter(data);
	        });
	    }
		
		function executeActionAndRefreshPrinters(command, message, service, targetPrinter, postTargetPrinter) {
			if (targetPrinter === null) {
    			$scope.$emit("MachineResponse", {machineResponse: {command:command, message:message, successFunction:null, afterErrorFunction:null}});
		        return;
			}
			var printerName = encodeURIComponent(targetPrinter.configuration.name);
			if (postTargetPrinter) {
			   $http.post(service, targetPrinter).then(
	       			function(response) {
	        			$scope.$emit("MachineResponse", {machineResponse: {command:"Settings Saved!", message:"Your new settings have been saved. Please start the printer to make use of these new settings!.", response:true}, successFunction:null, afterErrorFunction:null});
	       			refreshPrinters();
	       			refreshSlicingProfiles();
	       			refreshMachineConfigurations();
	       			}, 
	       			function(response) {
 	        			$scope.$emit("HTTPError", {status:response.status, statusText:response.data});
	       		}).then(function() {
	       			    $('#start-btn').attr('class', 'fa fa-play');
	        			$('#stop-btn').attr('class', 'fa fa-stop');
	       		});
		    } else {
		       $http.get(service + printerName).then(
		       		function(response) {
		        		$scope.$emit("MachineResponse", {machineResponse: response.data, successFunction:refreshPrinters, afterErrorFunction:null});
		       		}, 
		       		function(response) {
	 	        		$scope.$emit("HTTPError", {status:response.status, statusText:response.data});
		       		}).then(function() {
		       			    $('#start-btn').attr('class', 'fa fa-play');
		        			$('#stop-btn').attr('class', 'fa fa-stop');
		       		});
			}
		}
		
		$scope.editCurrentPrinter = function editCurrentPrinter(editTitle) {
			controller.editTitle = editTitle;
			controller.editPrinter = JSON.parse(JSON.stringify(controller.currentPrinter));
			openSavePrinterDialog(editTitle, false);
		}

		$scope.savePrinter = function savePrinter(printer, renameProfiles) {
			
			if (renameProfiles) {
				controller.editPrinter.configuration.MachineConfigurationName = controller.editPrinter.configuration.name;
				controller.editPrinter.configuration.SlicingProfileName = controller.editPrinter.configuration.name;
			}
			executeActionAndRefreshPrinters("Save Printer", "No printer selected to save.", '/services/printers/save', printer, true);
	        controller.editPrinter = null;
	        controller.openType = null;
	        photonicUtils.clearPreviewExternalState();
		}
		
		function openSavePrinterDialog(editTitle, isNewPrinter) {
			var editPrinterModal = $uibModal.open({
		        animation: true,
		        templateUrl: 'editPrinter.html',
		        controller: 'EditPrinterController',
		        size: "lg",
		        resolve: {
		        	title: function () {return editTitle;},
		        	editPrinter: function () {return controller.editPrinter;}
		        }
			});
		    editPrinterModal.result.then(function (savedPrinter) {$scope.savePrinter(savedPrinter, isNewPrinter)});
		}
		
		function createNewResinProfile(newResinProfile) {
			// this adds the new resinprofile in the current selected slicingprofile
			var newSlicingProfile = controller.currentPrinter.configuration.slicingProfile;
			newSlicingProfile.InkConfig.push(newResinProfile);
									
			// this re-uploads the changed profile
			$http.put("services/machine/slicingProfiles", newSlicingProfile).then(
		    		function (data) {
		    			// for some reason this is needed when it is the currently loaded profile, otherwise it won't show after refresh
				        $http.post('/services/printers/save', controller.currentPrinter).success(
				        		function () {
				        			refreshSlicingProfiles();
					    			$scope.$emit("MachineResponse", {machineResponse: {command:"Settings Saved!", message:"Your new resin profile has been added!.", response:true}, successFunction:null, afterErrorFunction:null});
				        		}).error(
			    				function (data, status, headers, config, statusText) {
			 	        			$scope.$emit("HTTPError", {status:status, statusText:data});
				        		})
		    		},
		    		function (error) {
 	        			$scope.$emit("HTTPError", {status:error.status, statusText:error.data});
		    		}
		    )	
		}
		
		this.copySlicingProfile = function copySlicingProfile(editTitle) {
			controller.currentSlicingProfile = JSON.parse(JSON.stringify(controller.currentPrinter.configuration.slicingProfile));
			controller.currentSlicingProfile.name = controller.currentSlicingProfile.name + " (Copy) ";
			openCopySlicingProfileDialog(controller.currentSlicingProfile, editTitle, controller.currentSlicingProfile.name);
		}
		
		function SaveEditSlicingProfile(savedProfile){
			$http.put("services/machine/slicingProfiles", savedProfile).then(
		    		function (data) {
		    			refreshSlicingProfiles();
		    			$scope.$emit("MachineResponse", {machineResponse: {command:"Settings Saved!", message:"Your slicing profile has been copied!.", response:true}, successFunction:null, afterErrorFunction:null});
		    		},
		    		function (error) {
 	        			$scope.$emit("HTTPError", {status:error.status, statusText:error.data});
		    		}
		    )
		}
		
		this.openSaveResinDialog = function openSaveResinDialog(editTitle) {
			var editPrinterModal = $uibModal.open({
		        animation: true,
		        templateUrl: 'editResin.html',
		        controller: 'EditResinController',
		        size: "lg",
		        resolve: {
		        	title: function () {return editTitle;},
		        	editPrinter: function () {return controller.editPrinter;}
		        }
			});
		    editPrinterModal.result.then(function (newResinProfile) {
		    	createNewResinProfile(newResinProfile)
			});
		}
		
		function openCopySlicingProfileDialog(data, editTitle, currentSlicingProfileName) {
			var copySlicingProfileModal = $uibModal.open({
		        animation: true,
		        templateUrl: 'copySlicingProfile.html',
		        controller: 'copySLicingProfileController',
		        size: "lg",
		        resolve: {
		        	title: function () {return editTitle;},
		        	sliceData: function () {return data;},
					nameProfile: function() {return currentSlicingProfileName;}
		        }
			});
		    copySlicingProfileModal.result.then(function (savedProfile) {
				SaveEditSlicingProfile(savedProfile);  
			});
		}

		this.deleteSlicingProfile = function deleteSlicingProfile(profileName, newProfile) {
			
			var profileNameEn = encodeURIComponent(profileName);
		     $http.delete("/services/machine/slicingProfiles/" + profileNameEn).success(function (data) {
		       	 refreshSlicingProfiles();
		    	 $scope.$emit("MachineResponse", {machineResponse: {command:"Settings removed!", message:"Your slicing profile has been removed succesfully!.", response:true}, successFunction:null, afterErrorFunction:null});							
		    	
		     }).error(
	    				function (data, status, headers, config, statusText) {
	 	        			$scope.$emit("HTTPError", {status:status, statusText:data});
		        		})
		}
		
		this.deleteCurrentResinProfile = function deleteCurrentResinProfile(slicingProfile) {
			// removes the selected resinprofile from the old profile
			slicingProfile.InkConfig.splice(slicingProfile.selectedInkConfigIndex,1);
			
			// this re-uploads the changed profile
			$http.put("services/machine/slicingProfiles", slicingProfile).then(
		    		function (data) {
		    			// for some reason this is needed when it is the currently loaded profile, otherwise it won't show after refresh
				        $http.post('/services/printers/save', controller.currentPrinter).success(
				        		function () {
				        			refreshSlicingProfiles();
					    			$scope.$emit("MachineResponse", {machineResponse: {command:"Settings Saved!", message:"Your resin profile has been removed!.", response:true}, successFunction:null, afterErrorFunction:null});
				        		}).error(
			    				function (data, status, headers, config, statusText) {
			 	        			$scope.$emit("HTTPError", {status:status, statusText:data});
				        		})
		    		},
		    		function (error) {
 	        			$scope.$emit("HTTPError", {status:error.status, statusText:error.data});
		    		}
		    )
		}
			
		//TODO: When we get an upload complete message, we need to refresh file list...
		$scope.showFontUpload = function showFontUpload() {
			var fileChosenModal = $uibModal.open({
		        animation: true,
		        templateUrl: 'upload.html',
		        controller: 'UploadFileController',
		        size: "lg",
		        resolve: {
		        	title: function () {return "Upload True Type Font";},
		        	supportedFileTypes: function () {return ".ttf";},
		        	getRestfulFileUploadURL: function () {return function (filename) {return '/services/machine/uploadFont';}},
		        	getRestfulURLUploadURL: function () {return null;}
		        }
			});
			
			//fileChosenModal.result.then(function (savedPrinter) {$scope.savePrinter(savedPrinter, newPrinter)});
		}
		
		$scope.installCommunityPrinter = function installCommunityPrinter(printer) {
	        $http.get(printer.url).success(
	        		function (data) {
	        			controller.editPrinter = JSON.parse(window.atob(data.content));
	        			$scope.savePrinter(controller.editPrinter, false);
	        		}).error(
    				function (data, status, headers, config, statusText) {
 	        			$scope.$emit("HTTPError", {status:status, statusText:data});
	        		})
	        return;
	    }
		
		this.createNewPrinter = function createNewPrinter(editTitle) {
			if (controller.currentPrinter == null) {
		        $http.post('/services/printers/createTemplatePrinter').success(
		        		function (data) {
		        			controller.editPrinter = data;
		        			openSavePrinterDialog(editTitle, true);
		        		}).error(
	    				function (data, status, headers, config, statusText) {
	 	        			$scope.$emit("HTTPError", {status:status, statusText:data});
		        		})
		        return;
			}
			
			controller.editPrinter = JSON.parse(JSON.stringify(controller.currentPrinter));
			controller.editPrinter.configuration.name = controller.editPrinter.configuration.name + " (Copy)";
			//These must be set before we save a printer, otherwise the xml files aren't saved properly
			controller.editPrinter.configuration.MachineConfigurationName = controller.editPrinter.configuration.name;
			controller.editPrinter.configuration.SlicingProfileName = controller.editPrinter.configuration.name;
			openSavePrinterDialog(editTitle, true);
		}
		this.writePegExposureCode = function writePegExposureCode() {
			controller.currentPrinter.configuration.slicingProfile.TwoDimensionalSettings.PlatformCalculator = 
				    "var pegSettingsMM = {\n" +
					"  rows: 5,\n" +
					"  columns: 5,\n" +
					"  fontDepth: .5,\n" +
					"  fontPointSize: 42,\n" +
					"  startingOverhangDegrees: 45,\n" +
					"  degreeIncrement: 5,\n" +
					"  pegDiameter: 3,\n" +
					"  pegStandHeight: 1,\n" +
					"  pegStandWidth: 5,\n" +
					"  distanceBetweenStands: 1,\n" +
					"  exposureTimeDecrementMillis: 1000};\n\n" +
					"var pegStandCount = pegSettingsMM.pegStandHeight / $LayerThickness;\n" +
					"var fontCount = pegSettingsMM.fontDepth / $LayerThickness;\n" +
					"var pegSettingsPixels = {\n" +
					"  pegDiameterX: pegSettingsMM.pegDiameter * pixelsPerMMX,\n" +
					"  pegDiameterY: pegSettingsMM.pegDiameter * pixelsPerMMY,\n" +
					"  pegStandWidthX: pegSettingsMM.pegStandWidth * pixelsPerMMX,\n" +
					"  pegStandWidthY: pegSettingsMM.pegStandWidth * pixelsPerMMY,\n" +
					"  distanceBetweenStandsX: pegSettingsMM.distanceBetweenStands * pixelsPerMMX,\n" +
					"  distanceBetweenStandsY: pegSettingsMM.distanceBetweenStands * pixelsPerMMY,\n" +
					"  pegStandDifferenceOffsetX: ((pegSettingsMM.pegStandWidth * pixelsPerMMX) - (pegSettingsMM.pegDiameter * pixelsPerMMX)) / 2,\n" +
					"  pegStandDifferenceOffsetY: ((pegSettingsMM.pegStandWidth * pixelsPerMMY) - (pegSettingsMM.pegDiameter * pixelsPerMMY)) / 2\n" +
					"}\n" +
					"if ($CURSLICE < pegStandCount) {\n" +
					"   for (var x = 0; x < pegSettingsMM.columns; x++) {\n" +
					"      for (var y = 0; y < pegSettingsMM.rows; y++) {\n" +
					"         var overhangAngle = pegSettingsMM.startingOverhangDegrees + y * pegSettingsMM.degreeIncrement;\n" +
					"         var startingX = x * pegSettingsPixels.pegStandWidthX + x * pegSettingsPixels.distanceBetweenStandsX;\n" +
					"         var startingY = y * pegSettingsPixels.pegStandWidthY + y * pegSettingsPixels.distanceBetweenStandsY;\n" +
					"         buildPlatformGraphics.setColor(java.awt.Color.WHITE);\n" +
					"         buildPlatformGraphics.fillRect(\n" +
					"            startingX,\n" +
					"            startingY,\n" +
					"            pegSettingsPixels.pegStandWidthX,\n" +
					"            pegSettingsPixels.pegStandWidthY);\n" +
					"         if ($CURSLICE < fontCount) {\n" +
					"            buildPlatformGraphics.setColor(java.awt.Color.BLACK);\n" +
					"            buildPlatformGraphics.setFont(new java.awt.Font(\"Dialog\", 0, pegSettingsMM.fontPointSize));\n" +
					"            buildPlatformGraphics.drawString(overhangAngle + \"\", startingX, startingY + pegSettingsPixels.pegStandWidthY);\n" +
					"         }\n" +
					"         exposureTimers.add({\n" +
					"             delayMillis:$LayerTime - (pegSettingsMM.exposureTimeDecrementMillis * x),\n" + 
					"             parameter:{x:startingX, y:startingY, width:pegSettingsPixels.pegStandWidthX, height:pegSettingsPixels.pegStandWidthY},\n" +
					"             function:function(blackRect) {\n" +
					"                buildPlatformGraphics.setColor(java.awt.Color.BLACK);\n" +
					"                buildPlatformGraphics.fillRect(\n" +
					"                   blackRect.x,\n" +
					"                   blackRect.y,\n" +
					"                   blackRect.width,\n" +
					"                   blackRect.height);\n" +
					"             }\n" +
					"         });\n" +
					"      }\n" +
					"   }\n" +
					"} else {\n" +
					"   for (var x = 0; x < pegSettingsMM.columns; x++) {\n" +
					"      for (var y = 0; y < pegSettingsMM.rows; y++) {\n" +
					"         var overhangAngle = pegSettingsMM.startingOverhangDegrees + y * pegSettingsMM.degreeIncrement;\n" +
					"         var singleOverhangIncrement = java.lang.Math.tan(java.lang.Math.toRadians(overhangAngle)) * $LayerThickness * pixelsPerMMX;\n" +
					"         var circleOffsetX = pegSettingsPixels.pegStandDifferenceOffsetX * ((x + 1) * 2 - 1) + (singleOverhangIncrement * ($CURSLICE - pegStandCount)) + (x * pegSettingsPixels.pegDiameterX) + (x * pegSettingsPixels.distanceBetweenStandsX);\n" +
					"         var circleOffsetY = pegSettingsPixels.pegStandDifferenceOffsetY * ((y + 1) * 2 - 1) + (y * pegSettingsPixels.pegDiameterY) + (y * pegSettingsPixels.distanceBetweenStandsY);\n" +
					"         buildPlatformGraphics.fillOval(\n" +
					"            circleOffsetX,\n" +
					"            circleOffsetY,\n" +
					"            pegSettingsPixels.pegDiameterX,\n" +
					"            pegSettingsPixels.pegDiameterY);\n" +
					"         exposureTimers.add({\n" +
					"             delayMillis:$LayerTime - (pegSettingsMM.exposureTimeDecrementMillis * x),\n" +
					"             parameter:{x:circleOffsetX, y:circleOffsetY, width:pegSettingsPixels.pegDiameterX, height:pegSettingsPixels.pegDiameterY},\n" +
					"             function:function(blackRect) {\n" +
					"                buildPlatformGraphics.setColor(java.awt.Color.BLACK);\n" +
					"                buildPlatformGraphics.fillOval(\n" +
					"                   blackRect.x,\n" +
					"                   blackRect.y,\n" +
					"                   blackRect.width,\n" +
					"                   blackRect.height);\n" +
					"             }\n" +
					"         });\n" +
					"      }\n" +
					"   }\n" +
					"}\n";
		}
		
		this.writeHBridgeCode = function writeHBridgeCode() {
			controller.currentPrinter.configuration.slicingProfile.TwoDimensionalSettings.PlatformCalculator = 
				        "var hBridgeInMM = {\n" +
						"   wallWidth:1,\n" +
						"   gapLength:4,\n" +
						"   firstGapWidth:3,\n" +
						"   numberOfGapsInRow:6,\n" +
						"   gapWidthIncrement:3,\n" +
						"   distanceBetweenRows:1,\n" +
						"   numberOfRows:5,\n" +
						"   exposureTimeDecrementMillis:1000\n" +
						"  };\n\n" +
						"var wallWidthX = hBridgeInMM.wallWidth * pixelsPerMMX;\n" +
						"var wallWidthY = hBridgeInMM.wallWidth * pixelsPerMMY;\n" +
						"var gapLengthY = hBridgeInMM.gapLength * pixelsPerMMY;\n" +
						"var lastTermOfSeries = hBridgeInMM.firstGapWidth + hBridgeInMM.gapWidthIncrement * (hBridgeInMM.numberOfGapsInRow - 1);\n" +
						"var totalWidthX = ((hBridgeInMM.wallWidth + hBridgeInMM.wallWidth * hBridgeInMM.numberOfGapsInRow) + (hBridgeInMM.numberOfGapsInRow * (hBridgeInMM.firstGapWidth + lastTermOfSeries) / 2)) * pixelsPerMMX;\n" +
						"var startX = centerX - totalWidthX / 2;\n" +
						"var startY = hBridgeInMM.numberOfRows * (hBridgeInMM.gapLength * 2 + hBridgeInMM.wallWidth) + (hBridgeInMM.numberOfRows - 1) * hBridgeInMM.distanceBetweenRows;\n" +
						"startY = centerY - startY * pixelsPerMMY / 2;\n" +
						"var currentY = startY;\n" +
						"buildPlatformGraphics.setColor(java.awt.Color.WHITE);\n" +
						"for (var currentRow = 0; currentRow < hBridgeInMM.numberOfRows; currentRow++) {\n" +
						"   var currentX = startX;\n" +
						"   for (var currentGap = 0; currentGap < hBridgeInMM.numberOfGapsInRow; currentGap ++) {\n" +
						"      if ($CURSLICE + 1 < job.totalSlices) {\n" +
						"         buildPlatformGraphics.fillRect(currentX, currentY, wallWidthX, gapLengthY * 2 + wallWidthY);\n" +
						"         currentX += wallWidthX + (hBridgeInMM.firstGapWidth + (hBridgeInMM.gapWidthIncrement * currentGap)) * pixelsPerMMX;\n" +
						"      }\n" +
						"   }\n" +
						"   if ($CURSLICE + 1 < job.totalSlices) {\n" +
						"      buildPlatformGraphics.fillRect(currentX, currentY, wallWidthX, gapLengthY * 2 + wallWidthY);\n" +
						"      buildPlatformGraphics.fillRect(startX, currentY + gapLengthY, totalWidthX, wallWidthY);\n" +
						"   } else {\n" +
						"      buildPlatformGraphics.fillRect(startX, currentY, totalWidthX, gapLengthY * 2 + wallWidthY);\n" +
						"      exposureTimers.add({\n" +
						"      	  delayMillis:$LayerTime - (hBridgeInMM.exposureTimeDecrementMillis * currentRow),\n" + 
						"         parameter:{x:startX, y:currentY, width:totalWidthX, height:gapLengthY * 2 + wallWidthY},\n" + 
						"         function:function(blackRect) {\n" +
						"            buildPlatformGraphics.setColor(java.awt.Color.BLACK);\n" +
						"            buildPlatformGraphics.fillRect(blackRect.x, blackRect.y, blackRect.width, blackRect.height);\n" +
						"         }\n" +
						"      });\n" +
						"   }\n" +
						"   currentY += gapLengthY * 2 + wallWidthY + hBridgeInMM.distanceBetweenRows * pixelsPerMMY;\n" +
						"}\n";
		}
		
		this.startCurrentPrinter = function startCurrentPrinter() {
			$('#start-btn').attr('class', 'fa fa-refresh fa-spin');
			executeActionAndRefreshPrinters("Start Printer", "No printer selected to start.", '/services/printers/start/', controller.currentPrinter, false);
		}
		
		this.stopCurrentPrinter = function stopCurrentPrinter() {
			$('#stop-btn').attr('class', 'fa fa-refresh fa-spin');			
			executeActionAndRefreshPrinters("Stop Printer", "No printer selected to Stop.", '/services/printers/stop/', controller.currentPrinter, false);
		}
		
		this.deleteCurrentPrinter = function deleteCurrentPrinter() {
			executeActionAndRefreshPrinters("Delete Printer", "No printer selected to Delete.", '/services/printers/delete/', controller.currentPrinter, false);
	        controller.currentPrinter = null;
		}
		
		this.changeHostname = function changeHostname(newHostname) {
			$http.get("/services/machine/setNetworkHostname/"+newHostname).success(
	        		function (data) {
	        			$scope.$emit("MachineResponse", {machineResponse: {command:"Hostname changed to: "+newHostname, message:"Your new hostname ("+newHostname+") will take effect the next time the printer is powered on.", response:true}, successFunction:null, afterErrorFunction:null});
	        		}).error(
    				function (data, status, headers, config, statusText) {
 	        			$scope.$emit("HTTPError", {status:status, statusText:data});
	        		})
	        return;
		}
		
		this.changeCurrentPrinter = function changeCurrentPrinter(newPrinter) {
			controller.currentPrinter = newPrinter;
		}
		
        this.gotoPrinterControls = function gotoPrinterControls() {
        	$location.path('/printerControlsPage').search({printerName: controller.currentPrinter.configuration.name})
        };
        
		this.testTemplate = function testTemplate(scriptName, script) {
			var printerNameEn = encodeURIComponent(controller.currentPrinter.configuration.name);
			var scriptNameEn = encodeURIComponent(scriptName);
			
			$http.post('/services/printers/testTemplate/' + printerNameEn + "/" + scriptNameEn, script).success(function (data) {
				if (data.error) {
	     			$scope.$emit("MachineResponse", {machineResponse: {command:scriptName, message:data.errorDescription}, successFunction:null, afterErrorFunction:null});
				} else {
	     			$scope.$emit("MachineResponse", {machineResponse: {command:scriptName, message:"Successful execution. Template returned:" + data.result, response:true}, successFunction:null, afterErrorFunction:null});
				}
			}).error(function (data, status, headers, config, statusText) {
     			$scope.$emit("HTTPError", {status:status, statusText:data});
    		})
		}
		
		this.testRemainingPrintMaterial = function testRemainingPrintMaterial(printer) {
			var printerNameEn = encodeURIComponent(printer.configuration.name);
			
			$http.get('/services/printers/remainingPrintMaterial/' + printerNameEn).success(function (data) {
				//if (data.error) {
	     			$scope.$emit("MachineResponse", {machineResponse: data, successFunction:null, afterErrorFunction:null});
				/*} else {
	     			$scope.$emit("MachineResponse", {machineResponse: {command:scriptName, message:"Successful execution. Template returned:" + data.result, response:true}, successFunction:null, afterErrorFunction:null});
				}*/
			}).error(function (data, status, headers, config, statusText) {
     			$scope.$emit("HTTPError", {status:status, statusText:data});
    		})
		}
		
		$http.get('/services/machine/supportedFontNames').success(
				function (data) {
					controller.fontNames = data;
					controller.loadingFontsMessage = "Select a font...";
				});
		
		function refreshSlicingProfiles() {
		$http.get('/services/machine/slicingProfiles/list').success(
				function (data) {
					controller.slicingProfiles = data;
					controller.loadingProfilesMessage = "Select a slicing profile...";
				});
		}
		
		function refreshMachineConfigurations() {
		$http.get('/services/machine/machineConfigurations/list').success(
				function (data) {
					controller.machineConfigurations = data;
					controller.loadingMachineConfigMessage = "Select a machine configuration...";
				});
		$http.get("https://api.github.com/repos/" + $scope.repo + "/contents/host/" + PRINTERS_DIRECTORY + "?ref=" + BRANCH).success(
			function (data) {
				$scope.communityPrinters = data;
			}
		);
		}
		
		this.testScript = function testScript(scriptName, returnType, script) {
			photonicUtils.testScript(controller, scriptName, returnType, script);
		};
		
		controller.inkDetectors = [{name:"Visual Ink Detector", className:"org.area515.resinprinter.inkdetection.visual.VisualPrintMaterialDetector"}];
		refreshPrinters();
		
		function attachToHost() {
			controller.hostSocket = cwhWebSocket.connect("services/hostNotification", $scope).onJsonContent(function(hostEvent) {
				controller.restartMessage = " " + hostEvent.message;	
				if (hostEvent.notificationEvent == "Ping") {
					var unmatchedPingCheck = function() {
						controller.hostSocket.sendMessage(hostEvent);
						
						if (unmatchedPing === 0) {
							controller.restartMessage = thankYouMessage;
							unmatchedPing = -1;//Start over from scratch if we get another ping!!!
						} else {
							unmatchedPing--;
							$interval(unmatchedPingCheck, timeoutValue, 1);
						}
					}
					
					if (unmatchedPing === -1) {
						$interval(unmatchedPingCheck, timeoutValue, 1);
					}
					
					unmatchedPing = maxUnmatchedPings;
				}
			}).onClose(function() {
				controller.restartMessage = thankYouMessage;
			});
			if (controller.hostSocket === null) {
				$scope.$emit("MachineResponse",  {machineResponse: {command:"Browser Too Old", message:"You will need to use a modern browser to run this application."}});
			}
		}
		
		this.connectToWireless = function connectToWireless() {
			controller.shutdownInProgress = true;
			$http.put("services/machine/wirelessConnect", controller.selectedNetworkInterface).then(
		    		function (data) {
		    			controller.restartMessage = " Waiting for host to start monitoring process.";
		    			$('#editModal').modal();
		    			
		    			$http.post("services/machine/startNetworkRestartProcess/600000/" + timeoutValue + "/" + maxUnmatchedPings).then(
		    		    		function (data) {
		    		    			controller.restartMessage = " Network monitoring has been setup.";
		    		    		},
		    		    		function (error) {
		    		    			controller.restartMessage = " Print host was unable to start network monitoring process. Click cancel."
		    		    		}
		    		    )
		    		},
		    		function (error) {
 	        			$scope.$emit("HTTPError", {status:error.status, statusText:error.data});
 	        			controller.shutdownInProgress = false;
		    		}
		    )
		};
		
		this.saveSkin = function saveSkin(skin){
		     $http.put("services/settings/skins", skin).then(function () {
		    	 controller.loadSkins();
	         })
		};
		
		//TODO: this needs to be attached to more than just the cancel button so that we can kill the web socket.
		this.cancelRestartProcess = function cancelRestartProcess() {
			$http.post("services/machine/cancelNetworkRestartProcess").then(
		    		function (data) {
		    			controller.shutdownInProgress = false;
		    		},
		    		function (error) {
		    			controller.shutdownInProgress = false;
 	        			$scope.$emit("HTTPError", {status:error.status, statusText:error.data});
		    		}
		    )
		}
		this.saveEmailSettings = function saveEmailSettings() {
			if (!Array.isArray(controller.emailSettings.notificationEmailAddresses)) {
				controller.emailSettings.notificationEmailAddresses = [controller.emailSettings.notificationEmailAddresses];
			}
			if (!Array.isArray(controller.emailSettings.serviceEmailAddresses)) {
				controller.emailSettings.serviceEmailAddresses = [controller.emailSettings.serviceEmailAddresses];
			}
			$http.put("services/settings/emailSettings", controller.emailSettings).then(
		    		function (data) {
		    			alert("Email settings saved.");
		    		},
		    		function (error) {
 	        			$scope.$emit("HTTPError", {status:error.status, statusText:error.data});
		    		}
		    )
		};
		
		this.loadSkins = function loadSkins() {
		  	$http.get("services/settings/skins/list").success(
				function (data) {
					$scope.availableSkins = data;
					console.log(data);
				}
			);
		}
		
				$scope.ControlFlows = [	"Always",
		                        "OnSuccess",
		                        "OnSuccessAndCancellation"];
		
		$http.get("services/settings/emailSettings").success(
	    		function (data) {
	    			controller.emailSettings = data;
	    		})
		
		$http.get('/services/machine/getNetworkHostConfiguration').success(
				function(data) {
					controller.hostConfig = data;
				})
	    		
		$http.get("services/machine/wirelessNetworks/list").success(
	    		function (data) {
	    			controller.networkInterfaces = data;
	    			controller.loadingNetworksMessage = "Select a wifi network";
	    		})
	
		attachToHost();
		refreshSlicingProfiles();
		refreshMachineConfigurations();
		refreshPrinters();
		this.loadSkins();
	}])
})();
