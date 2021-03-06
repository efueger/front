var UploadFile = function(file) {
  var STATE_INITIALIZED = 0;
  var STATE_QUEUED      = 1;
  var STATE_INCOMPLETE  = 2;
  var STATE_FINISHED    = 3;
  var STATE_UPLOADING   = 4;
  var STATE_PAUSED      = 5;
  var STATE_CANCELED    = 6;

  var chunkSize = 1024 * 1024;
  var startTime;
  var hash;
  var id = -1;
  var chunks = [];
  var state = STATE_INITIALIZED;

  // Once the file has been hashed we can do things with it.
  this.onHashCalculated = function(sha) {
    hash = sha;

    // Check if the file has been uploaded or is in progress.
    this.fetchStatus(hash)

    // Not sure.
    this.updateViewCallback();
  }.bind(this);

  this.fetchStatus = function(hash) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/files/status/' + hash)
    xhr.addEventListener('readystatechange', this.onStatus.bind(this, xhr));
    xhr.send();
  };

  this.onStatus = function(xhr, evt) {
    if (xhr.readyState === 4) {
      if(xhr.status === 200) {
        var response = JSON.parse(xhr.response);
        id = response.id;

        switch(response.state) {
          case 'Incomplete':
            state = STATE_INCOMPLETE;
            break;
          default:
            console.log("unhandled state");
            console.log(response);
            break;
        }
      } else if (xhr.status == 404) {
        // file is not found, so we add it to the queue.
        state = STATE_QUEUED;
      }
    };

    this.updateViewCallback();
  };

  this.canStart = function() {
    return state == STATE_QUEUED || state == STATE_INCOMPLETE;
    // || state == STATE_PAUSED
  };

  this.createFile = function(callback) {
    var fileData = {
      size: file.size,
      name: this.name(),
      type: this.type(),
      chunks: this.numChunks(),
      hash: this.hash()
    };

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/files')
    xhr.setRequestHeader("Content-Type", "application/json")
    xhr.addEventListener('readystatechange', this.onFileCreate.bind(this, xhr, callback));
    xhr.send(JSON.stringify(fileData));
  };

  this.onFileCreate = function(xhr, callback) {
    if (xhr.readyState === 4) {
      if(xhr.status === 200) {
        id = JSON.parse(xhr.response).id;
        state = STATE_QUEUED;
        console.log(xhr);
        callback();
      } else {
        console.log("non 200 response from createfile");
        console.log(xhr);
      }
    }
  };

  this.start = function(callback) {
    this.createFile(callback);
    state = STATE_UPLOADING;
    this.updateViewCallback();
  };

  this.resume = function() {
  };

  this.restart = function() {
  };

  this.pause = function() {
    state = STATE_PAUSED ;
  };

  this.cancel = function() {
    for( var i = 0; i < chunks.length; i++ ) {
      chunks[i].cancel();
    }

    state = STATE_CANCELED ;
  };

  this.isInitialized = function() { return state == STATE_INITIALIZED; };
  this.isIncomplete = function() { return state == STATE_INCOMPLETE; };
  this.isQueued    = function() { return state == STATE_QUEUED; };
  this.isUploading = function() { return state == STATE_UPLOADING; };
  this.isFinished  = function() { return state == STATE_FINISHED; };
  this.isPaused    = function() { return state == STATE_PAUSED; };
  this.isCanceled  = function() { return state == STATE_CANCELED; };

  this.id = function() {
    return id;
  };

  this.blob = function() {
    return file.slice();
  };

  this.originalBlob = function() {
    return file;
  };

  // Progress in relation to all chunks.
  this.progressPercent = function() {
    var loaded = 0;

    for(var i = 0; i < chunks.length; i++) {
      loaded += chunks[i].loaded;
    }

    return loaded / file.size;
  };

  this.chunksFinished = function() {
    for ( var i = 0; i < chunks.length; i++ ) {
      if (!chunks[i].isFinished()) {
        return false;
      }
    }

    return true;
  };

  this.type = function() {
    return mime2name(file.type);
  };

  this.name = function() {
    return file.name;
  };

  this.numChunks = function() {
    return Math.ceil(file.size / chunkSize);
  };

  this.chunks = function() {
    return chunks;
  };

  this.size = function() {
    return filesize(file.size);
  };

  this.hash = function() {
    return hash;
  };

  this.onChunkStarted = function(chunk) {
    startTime = Date.now();
    state = STATE_UPLOADING;
  };

  this.onChunkFinished = function(chunk) {
    console.log("chunk finished");
    if ( this.chunksFinished()) {
      this.onFinished();
    }
  };

  this.onFinished = function() {
    console.log("upload finished");
    state = STATE_FINISHED;
    this.finishedCallback();
  };

  this.onChunkProgress = function(chunk, progress) {

  };

  // Overwritten, hopefully
  this.updateView = function(hash) {};

  // Split into chunks
  this.chunkFile = function() {
    for(var i = 0; i < this.numChunks(); i++) {
      var chunkData = file.slice(i*chunkSize, (i+1)*chunkSize);
      var chunk = new Chunk(chunkData, { position: i, file_id: this.id() });

      chunk.addStartCallback(this.onChunkStarted.bind(this, chunk));
      chunk.addFinishCallback(this.onChunkFinished.bind(this, chunk));
      chunk.addProgressCallback(this.onChunkProgress.bind(this, chunk));

      chunks.push(chunk);
    }

    return chunks;
  };
  // WTF is this?
  this.fakeUpload= function() {
    var b = new Blob(["ddawd"], { type: 'text/plain' });
    chunks.push(new Chunk(1, b));
    chunks.push(new Chunk(2, b));
    chunks.push(new Chunk(3, b));
  };

};

