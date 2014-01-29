'use strict';
document.addEventListener('DOMContentLoaded', function() {
  var pageTitleNode = document.querySelector('.header .title');

  var playbackSectionNode = document.querySelector('.playback.section');
  var titleNode = playbackSectionNode.querySelector('.title');
  var displayNode = playbackSectionNode.querySelector('.display');
  var playButtonNode = playbackSectionNode.querySelector('.play');
  var homeButtonNode = playbackSectionNode.querySelector('.home');

  var recordingSectionNode = document.querySelector('.recording.section');
  var recordingInputNode = recordingSectionNode.querySelector('[name="recording"]');
  var titleInputNode = recordingSectionNode.querySelector('[name="title"]');
  var resetButtonNode = recordingSectionNode.querySelector('.reset');

  pageTitleNode.addEventListener('click', function() {
    window.history.pushState('', '', '/');
    handleStateChange('');
  });

  homeButtonNode.addEventListener('click', function() {
    window.history.pushState('', '', '/');
    handleStateChange('');
  });

  resetButtonNode.addEventListener('click', function(event) {
    resetRecording()
    recordingInputNode.focus();
    event.preventDefault();
  });

  function showSection(sectionName) {
    Array.prototype.forEach.call(document.querySelectorAll('.section'), function(sectionNode) {
      if (sectionNode.classList.contains(sectionName)) {
        sectionNode.classList.add('visible');
      }
      else {
        sectionNode.classList.remove('visible');
      }
    });
  }

  function handleStateChange(state) {
    if (state !== null) {
      var id = state;

      if (id) {
        showSection('loading');
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            var response = JSON.parse(xhr.responseText);
            if (response.error) {
              showSection('recording');
              recordingInputNode.focus();
              console.log(response.error); // TODO handle properly
            }
            else if (response.result) {
              showSection('playback');
              playButtonNode.focus();
              titleNode.textContent = response.result.recording.title || 'Untitled recording';
              displayNode.setAttribute('data-recording', JSON.stringify(response.result.recording));
              displayNode.value = '';
              playTape();
            }
          }
        }
        xhr.open('GET', '/' + id);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send(null);
      }
      else {
        showSection('recording');
        recordingInputNode.focus();
      }
    }
  }

  window.addEventListener('popstate', function(event) {
    if (event) {
      handleStateChange(event.state);
    }
  });

  history.replaceState(location.pathname.substr(1), location.pathname.substr(1), location.pathname);
  handleStateChange(location.pathname.substr(1));

  // Recording
  var tape = [];
  var baseTime = null;

  recordingInputNode.addEventListener('keydown', setTimeout.bind(window, updateTape.bind(recordingInputNode)));

  function updateTape() {
    if (baseTime === null) {
      baseTime = new Date().getTime();
    }
    tape.push({
      time: new Date().getTime() - baseTime,
      content: this.value
    });
  }

  recordingSectionNode.addEventListener('submit', function(event) {
    event.preventDefault();

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        var response = JSON.parse(xhr.responseText);
        if (response.error) {
          console.log(response.error); // TODO handle properly
        }
        else if (response.result) {
          history.pushState(response.result.id, response.result.id, '/' + response.result.id);
          handleStateChange(response.result.id);
        }
      }
    }
    xhr.open('POST', '/');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(JSON.stringify({
      title: titleInputNode.value,
      data: tape
    }));

    resetRecording();
    showSection('loading');
  });

  function resetRecording() {
    title: recordingInputNode.value = '';
    title: titleInputNode.value = '';
    tape = [];
    baseTime = null;
  }

  // Playback
  var playbackId = 0;

  function playTape() {
    var currentPlaybackId = ++playbackId;
    var tape = JSON.parse(displayNode.getAttribute('data-recording')).data;

    function read() {
      if (currentPlaybackId === playbackId) {
        var currentFrameTime = new Date().getTime() - startTime;
        while (tape.length && currentFrameTime >= tape[0].time) {
          var head = tape.shift();
          var scrollDown = displayNode.scrollTop + displayNode.offsetHeight - 1 === displayNode.scrollHeight;
          displayNode.value = head.content;
          if (scrollDown) {
            displayNode.scrollTop = displayNode.scrollHeight - displayNode.offsetHeight + 1;
          }
        }
        if (tape.length) {
          window.requestAnimationFrame(read);
        }
      }
    }

    var startTime = new Date().getTime();
    read();
  }

  playButtonNode.addEventListener('click', playTape);
});
