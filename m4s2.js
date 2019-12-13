var request = require('request')
var fs = require('fs')
const https = require('https')
const http = require('http')
const cheerio = require('cheerio')
const zlib = require('zlib');
const child = require('child_process')
const querystring = require('querystring')
const url = require('url')

let num = 0
class DownloadTask {
  constructor(code = '', filename = '') {
    this.code = code
    this.filename = filename
    this.count = 0
    this.audioUrl = ''
    this.videoUrl = ''
    this.videoSize = 0
    this.audioSize = 0
    this.state = 'downloadFail'
    this.audioTmpFile = './video/atmp' + num + '.m4s'
    this.videoTmpFile = './video/vtmp' + num + '.m4s'
    num++
    this.num = num
    // this.log()
  }
  log() {
    let logJosn = fs.readFileSync('./log/log.json', 'utf-8')
    logJosn = JSON.parse(logJosn)
    if (!logJosn.taskList) {
      logJosn.taskList = []
    }
    let flag = 0
    logJosn.taskList.map(item => {
        if (item.code === this.code) {
            flag = 1
        }
    })
    let task = {
        state: this.state,
        filename: this.filename
    }
    if (flag) {
        task.changeTime = new Date().toLocaleString()
    } else {
        task.code = this.code
        task.code = this.code
        task.num = this.num
        task.time = new Date().toLocaleString()
    }
    logJosn.taskList.push(task)
    fs.writeFileSync('./log/log.json', JSON.stringify(logJosn))
  }
  startTask() {
    var options = {
      host: "www.bilibili.com",
      port: 443,
      method: "GET",
      path: `/video/${this.code}`,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36"
      }
    };
    console.log(`开始获取${this.code}的链接`)
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
                var playInfo = JSON.parse(str)
                var dash = playInfo.data.dash
                if (!dash) {
                  this.handleError({
                    type: 'get url',
                    message: 'no m4s'
                  })
                } else {
                  var audio = dash.audio
                  this.audioUrl = audio[0].baseUrl
                  var video = dash.video
                  this.videoUrl = video[0].baseUrl
                  this.getFileSize('video', this.videoTmpFile, this.videoUrl)
                  this.getFileSize('audio', this.audioTmpFile, this.audioUrl)
                //   console.log(`获取 ${this.code} 链接成功,开始下载`)
                //   this.downloadMedia('video', this.videoTmpFile, this.videoUrl)
                //   this.downloadMedia('audio', this.audioTmpFile, this.audioUrl)
                }
              }
            }
          }
      })
      res.on('error', error => {
        console.log('访问失败' + error)
      })
    })
  }
  getFileSize(type, tmpFilename, fileUrl) {
    var options = {
        headers: {
            'Origin': 'https://www.bilibili.com',
            'Referer': `https://www.bilibili.com/video/${this.code}`,
            'Sec-Fetch-Mode': 'cors',
            'Range': 'bytes=976-1163',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36'
          }
    }
    http.get(fileUrl, options, res => {
        let maxRange = res.headers['content-range']
        let size = maxRange.match(/\/([\d]+)$/)[1]
        console.log(this.code + '的' + type==='video'?'视频':'音频' + '的大小：' + (size / 1024 / 1024).toFixed(3) + 'm')
        this[type + 'Size'] = size
        res.resume();
        this.downloadMedia(type, tmpFilename, fileUrl, size)
        return
    })
  }
  downloadMedia(type, tmpFilename, mediaUrl, size) {
    var writeStream = fs.createWriteStream(tmpFilename)
    console.time(type + this.num)
    var readStream = request.get(mediaUrl, {
      headers: {
        'Origin': 'https://www.bilibili.com',
        'Referer': `https://www.bilibili.com/video/${this.code}`,
        'Sec-Fetch-Mode': 'cors',
        'Range': 'bytes=0-' + size,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36'
      }
    })
    readStream.on('end', function() {
      console.log((type === 'video' ? '视频' : '音频') + '下载成功')
    });
    readStream.on('error', err => {
      this.state = 'downloadFail'
      this.handleError(err)
    })
    writeStream.on('finish', () => {
      console.timeEnd(type + this.num)
      if (++this.count===2) {
        console.log(this.code + '开始合并')
        this.state = 'downloadSuccess'
        this.concatFile()
      }
      writeStream.end()
    })
    readStream.pipe(writeStream)
  }
  concatFile() {
    child.exec(`ffmpeg -i ${this.audioTmpFile} -i ${this.videoTmpFile} -c copy video/${this.filename}.mp4`, err => {
      if (err) {
        this.state = 'concatFail'
        this.handleError(error)
      }
      else {
        console.log(this.code + '合并成功, 开始删除临时文件')
        this.state = 'concatSuccess'
        this.deleteTmpFile(this.videoTmpFile, this.audioTmpFile)
      }
    })
  }
  deleteTmpFile() {
    const {videoTmpFile, audioTmpFile} = this
    if (fs.existsSync(videoTmpFile)) {
      fs.unlinkSync(videoTmpFile)
      console.log(this.code + '删除临时视频文件成功')
      this.state = 'deleteVideoTmpSuccess'
    } else {
      this.state = 'deleteVideoTmpFail'
      this.handleError({
        type: 'delete tmp file',
        message: this.code + '删除临时视频文件失败'
      })
    }
    if (fs.existsSync(audioTmpFile)) {
      fs.unlinkSync(audioTmpFile)
      console.log(this.code + '删除临时音频文件成功');
      this.state = 'finish'
      this.log()
    } else {
      this.state = 'deleteAudioTmpFail'
      this.handleError({
        type: 'delete tmp file',
        message: this.code + '删除临时音频文件失败'
      })
    }
  }
  handleError(error) {
    console.log(error)
    this.log()
  }
}

function writeEnd(res, params = {}) {
  if (params.msg) {
    res.writeHead(200, { "Content-Type": "text/plain;charset=utf-8" });
    res.write(params.msg);
    res.end();
  } else {
    fs.readFile("./view/index.html", "utf-8", function(error, data) {
      if (error) {
        console.log("index.html read error" + error);
      } else {
        res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
        res.write(data);
        res.end();
      }
    })
  }
}

function handleDownloadRequest(res, tmpUrl) {
  var code = url.parse(tmpUrl, true).query.code
  if (/^[\d]+$/.test(code)) code = 'av' + code
  if (code.indexOf('av') != 0) {
    writeEnd(res, { msg: 'code参数错误' })
  } else {
    let logJosn = fs.readFileSync('./log/log.json', 'utf-8')
    logJosn = JSON.parse(logJosn)
    let flag = 0
    if (logJosn.taskList) {
        logJosn.taskList.map(item => {
            if (item.code === code) {
                flag = 1
                if (item.state === 'finish') {
                    writeEnd(res, { msg: code + '已经下载过了' })
                } else {
                    writeEnd(res, { msg: '请手动删除临时文件并重新下载' })
                }
            }
        })
    }
    if (flag) return
    var filename = url.parse(tmpUrl, true).query.filename
    if (!filename) filename = code
    filename.replace(/[\s]/g, '')
    if (fs.existsSync(`video/${filename}.mp4`)) {
      writeEnd(res, { msg: `文件--${filename}--已存在` })
    } else {
      var task = new DownloadTask(code, filename)
      writeEnd(res, { msg: '开始下载' })
      task.startTask()
    }
  }
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
    handleDownloadRequest(res, tmpUrl)
  } else {
    writeEnd(res)
  }
}).listen(8888);
console.log('app is running in http://127.0.0.1:8888')