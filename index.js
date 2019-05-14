var BluetoothHciSocket = require('@abandonware/bluetooth-hci-socket');

var bluetoothHciSocket = new BluetoothHciSocket();

const IBKS = Buffer.from('2744e9e043e5', 'hex')
const eddystoneSignature = Buffer.from('0201060303aafe', 'hex')
const foo = Buffer.from('043e', 'hex') //2502010001

bluetoothHciSocket.on('data', function(data) {
	var gapAdvType = data.readUInt8(5);
	var gapAddrType = data.readUInt8(6);
	var gapAddr = data.slice(7, 13);
	if (Buffer.compare(data.slice(0,2), foo) === 0) {
	// if (Buffer.compare(gapAddr, IBKS) === 0) {
		let advAddrPlainText = gapAddr.toString('hex').match(/.{1,2}/g).reverse().join(':')
		var advLength = data.readUInt8(13);
		var eir = data.slice(14, 14 + advLength);
		var rssi = data.readInt8(data.length - 1);

		/*
		console.log('\t' + ['ADV_IND', 'ADV_DIRECT_IND', 'ADV_SCAN_IND', 'ADV_NONCONN_IND', 'SCAN_RSP'][gapAdvType]);
		console.log('\t' + ['PUBLIC', 'RANDOM'][gapAddrType]);
		console.log('\t' + gapAddr.toString('hex').match(/.{1,2}/g).reverse().join(':'));
		*/

	if(Buffer.compare(eir.slice(0,7), eddystoneSignature) === 0) {
			console.info(`advAddr: ${advAddrPlainText}`)
			let esData = eir.slice(7)
			let advLength = esData.readUInt8(13);
			esData = esData.slice(4, advLength + 1)
			if (esData[0] === 0x20) {
				try {
					let tlmVersion = esData[1]
					let vBat = esData.readInt16BE(2,2)
					let temp = esData.readIntBE(4,1) + esData.readIntBE(5,1)/256
					let advCount = esData.readInt32BE(6,4)
					let secCount = esData.readInt32BE(10,4)/10

					console.info(`vBat: ${vBat} mV`)
					console.info(`temp: ${temp} °C`)
					console.info('advCount: ', advCount)
					console.info('days since power up: ', secCount/3600/24)
				} catch (e) {
					console.error(`Error occured with advertisement ${data.toString('hex')}`)
					console.error(e)
				}
			}
			console.info('rssi: ', rssi)
			console.info('- - - - - - - - - - - - ')
		}
	}
});

bluetoothHciSocket.on('error', function(error) {
  // TODO: non-BLE adaptor

  if (error.message === 'Operation not permitted') {
    console.log('state = unauthorized');
  } else if (error.message === 'Network is down') {
    console.log('state = powered off');
  } else {
    console.error(error);
  }
});

var HCI_COMMAND_PKT = 0x01;
var HCI_ACLDATA_PKT = 0x02;
var HCI_EVENT_PKT = 0x04;

var EVT_CMD_COMPLETE = 0x0e;
var EVT_CMD_STATUS = 0x0f;
var EVT_LE_META_EVENT = 0x3e;

var EVT_LE_ADVERTISING_REPORT = 0x02;

var OGF_LE_CTL = 0x08;
var OCF_LE_SET_SCAN_PARAMETERS = 0x000b;
var OCF_LE_SET_SCAN_ENABLE = 0x000c;


var LE_SET_SCAN_PARAMETERS_CMD = OCF_LE_SET_SCAN_PARAMETERS | OGF_LE_CTL << 10;
var LE_SET_SCAN_ENABLE_CMD = OCF_LE_SET_SCAN_ENABLE | OGF_LE_CTL << 10;

var HCI_SUCCESS = 0;

function setFilter() {
  var filter = Buffer.alloc(14);
  var typeMask = (1 << HCI_EVENT_PKT);
  var eventMask1 = (1 << EVT_CMD_COMPLETE) | (1 << EVT_CMD_STATUS);
  var eventMask2 = (1 << (EVT_LE_META_EVENT - 32));
  var opcode = 0;

  filter.writeUInt32LE(typeMask, 0);
  filter.writeUInt32LE(eventMask1, 4);
  filter.writeUInt32LE(eventMask2, 8);
  filter.writeUInt16LE(opcode, 12);

  bluetoothHciSocket.setFilter(filter);
}

function setScanParameters() {
  var cmd = Buffer.alloc(11);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_SCAN_PARAMETERS_CMD, 1);

  // length
  cmd.writeUInt8(0x07, 3);

  // data
  cmd.writeUInt8(0x01, 4); // type: 0 -> passive, 1 -> active
  cmd.writeUInt16LE(0x0010, 5); // internal, ms * 1.6
  cmd.writeUInt16LE(0x0010, 7); // window, ms * 1.6
  cmd.writeUInt8(0x00, 9); // own address type: 0 -> public, 1 -> random
  cmd.writeUInt8(0x00, 10); // filter: 0 -> all event types

  bluetoothHciSocket.write(cmd);
}

function setScanEnable(enabled, duplicates) {
  var cmd = Buffer.alloc(6);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(LE_SET_SCAN_ENABLE_CMD, 1);

  // length
  cmd.writeUInt8(0x02, 3);

  // data
  cmd.writeUInt8(enabled ? 0x01 : 0x00, 4); // enable: 0 -> disabled, 1 -> enabled
  cmd.writeUInt8(duplicates ? 0x01 : 0x00, 5); // duplicates: 0 -> no duplicates, 1 -> duplicates

  bluetoothHciSocket.write(cmd);
}

bluetoothHciSocket.bindRaw();
setFilter();
bluetoothHciSocket.start();

setScanParameters()
setScanEnable(true, false);
