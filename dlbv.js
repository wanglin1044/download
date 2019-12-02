var https = require('https');
var request = require('request')
var fs = require('fs');

var filename = 'zsy.flv'

var aid = 34592051
var cid = null
var options = {
    headers: {
        'Origin': 'https://www.bilibili.com',
        'Referer': 'https://www.bilibili.com/video/av' + aid,
        'Sec-Fetch-Mode': 'cors',
        'Cookie': "",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36'
    }
}
// 下载视频
function dlVideo(url) {
    var stream = fs.createWriteStream(filename);
    request.get(url, options).pipe(stream).on('close', (d) => {console.log('over')})
}
// 获取视频flv链接
function getVideoUrl() {
    var url = `https://api.bilibili.com/x/player/playurl?avid=${aid}&cid=${cid}&otype=json&qn=80`
    https.get(url, options, res => {
        var result = ''
        res.on('data', data => {
            result += data
        })
        res.on('end', () => {
            result = JSON.parse(result)
            var vUrl = result.data.durl[0].url
            vUrl = vUrl.replace('http', 'https')
            dlVideo(vUrl)
        })
        res.on('error', err => {
            process.stdout.write(err)
        })
    }).on('error', e => {
        console.log(e)
    })
}
// 根据aid获取视频cid
function getVideoInfo() { 
    var url = 'https://api.bilibili.com/x/player/pagelist?aid=' + aid + '&jsonp=jsonp'
    https.get(url, options, res => {
        res.on('data', data => {
            cid = (JSON.parse(data)).data[0].cid
            getVideoUrl()
        })
        res.on('error', err => {
            process.stdout.write(err)
        })
    }).on('error', e => {
        console.log(e)
    })
}
getVideoInfo()