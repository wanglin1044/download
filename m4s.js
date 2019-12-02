var request = require('request')
var fs = require('fs')
const https = require('https')
const http = require('http')
const cheerio = require('cheerio')
const zlib = require('zlib');
const child = require('child_process')
const querystring = require('querystring')
const url = require('url')


var count = 0
var flag = 0

function deleteTmpFile() {
  if (fs.existsSync('tmp1.m4s')) {
    fs.unlinkSync('tmp1.m4s')
    console.log('删除临时视频文件成功');
  }
  if (fs.existsSync('tmp2.m4s')) {
    fs.unlinkSync('tmp2.m4s')
    console.log('删除临时音频文件成功');
  }
  flag = 0
}

function concatFile(filename) {
  child.exec(`ffmpeg -i tmp2.m4s -i tmp1.m4s -c copy ${filename}.mp4`, function(err) {
    if (err) console.log(err.message)
    else {
      console.log('合并成功')
      deleteTmpFile()
    }
  })
}

function downloadVideo(url, code, filename) {
  var writeStream = fs.createWriteStream('tmp1.m4s');
  console.log('开始下载视频')
  console.time('videoTime')
  var readStream = request.get(url, {
    headers: {
      'Origin': 'https://www.bilibili.com',
      'Referer': `https://www.bilibili.com/video/${code}`,
      'Sec-Fetch-Mode': 'cors',
      'Range': 'bytes=0-999999999',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36'
    }
  })
  readStream.on('end', function() {
    console.log('视频下载成功');
  });
  readStream.on('error', function(err) {
    console.log("错误信息:" + err)
  })
  writeStream.on("finish", function() {
    console.timeEnd('videoTime')
    if (++count===2) {
      console.timeEnd('totalTime')
      count = 0
      concatFile(filename)
    }
    writeStream.end()
  })
  readStream.pipe(writeStream)
}
function downloadAudio(url, code, filename) {
  var writeStream = fs.createWriteStream('tmp2.m4s');
  console.log('开始下载音频')
  console.time('audioTime')
  var readStream = request.get(url, {
    headers: {
      'Origin': 'https://www.bilibili.com',
      'Referer': `https://www.bilibili.com/video/${code}`,
      'Sec-Fetch-Mode': 'cors',
      'Range': 'bytes=0-100000000',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36'
    }
  })
  readStream.pipe(writeStream)
  readStream.on('end', function() {
    console.log('音频下载成功');
  });
  readStream.on('error', function(err) {
    console.log("错误信息:" + err)
  })
  writeStream.on("finish", function() {
    console.timeEnd('audioTime')
    if (++count===2) {
      console.timeEnd('totalTime')
      count = 0
      concatFile(filename)
    }
    writeStream.end()
  })
}

function getUrl(code, filename) {
  var options = {
    host: "www.bilibili.com",
    port: 443,
    method: "GET",
    path: `/video/${code}`,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36"
    }
  };
  https.get(options, res => {
    var html = "", output
    if (res.headers['content-encoding'] == 'gzip') { // 处理gzip格式的网页
      var gzip = zlib.createGunzip();
      res.pipe(gzip);
      output = gzip;
    } else {
      output = res;
    }
    output.on('data', data => { // 接收数据
      data = data.toString('utf-8');
      html += data;
    })
    output.on("end", () => {
        var $ = cheerio.load(html)
        var scripts = $("script")
        for (let i = 0; i < scripts.length; i++) {
          if (scripts[i].children.length) {
            var script = scripts[i].children[0].data
            if (script && script.indexOf('__playinfo__') > -1) {
              var str = script.substring('window.__playinfo__='.length)
              playInfo = JSON.parse(str)
              var dash = playInfo.data.dash
              if (!dash) {
                console.log('no m4s')
                return
              }
              var audio = dash.audio
              var audioUrl = audio[0].baseUrl
              var video = dash.video
              var videoUrl = video[0].baseUrl
              console.time('totalTime')
              downloadVideo(videoUrl, code, filename)
              downloadAudio(audioUrl, code, filename)
              break
            }
          }
        }
    })
    res.on("error", (error) => {
      console.log("访问失败" + error)
    })
  })
}

http.createServer(function(req, res) {
  if (req.url == '/favicon.ico') {
    res.write("");
    res.end();
    return
  }
  var tmpUrl = querystring.unescape(req.url);
  tmpUrl = url.parse(tmpUrl, true);
  if (tmpUrl.pathname == "/down") {
    var code = url.parse(tmpUrl, true).query.code;
    var filename = url.parse(tmpUrl, true).query.filename;
    code && !flag ? getUrl(code, filename) : ''
    flag = 1
    res.write("开始下载");
    res.end();
  } else {
    fs.readFile("./view/index.html", "utf-8", function(error, data) {
      if (error) {
        console.log("index.html read error" + error);
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
      res.write(data);
      res.end();
    });
  }
}).listen(8888);
console.log('app is running in http://192.168.9.77:8888')