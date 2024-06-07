import { connect } from "http2"
import { readFileSync } from "fs"
// import net from 'net';
interface sockettype {
    datatype: "add" | "rm" | "list"
    name?: string,
    TCP?: boolean
    ip?: string
    cport?: number
    lport?: number
}

const net = require("net");
// UNIXドメインソケットのコネクションを作成する
// net.createConnectionの引数にファイルを指定するとUNIXドメインソケットで繋がる
const client = net.createConnection('/tmp/portfowardsuke.sock');
client.on('connect', () => {
    // console.log('connected.');
});
client.on('data', (data: any) => {
    // console.log(data.toString());
    //ここからはlist
    try {
        const data2: any[] = JSON.parse(data.toString());
        // console.log(data2)
        data2.map((elem) => {
            console.log(JSON.stringify(elem));
        })
    } catch (error) {
        console.log(data.toString());
    }

    client.end(); // 通信終了
});
client.on('end', () => {
    // console.log('disconnected.');
});
client.on('error', (err: any) => {
    console.error(err.message);
});
const testdata = {
    datatype: "add"
}
// const fuckindata: sockettype = {
//     datatype: "list",
//     name: "test444",
//     TCP: true,
//     ip: "192.168.0.20",
//     cport: 50,
//     lport: 50
// }

const senddata = JSON.parse(String(readFileSync("./testdata.json")))
client.write(String(JSON.stringify(senddata)));

