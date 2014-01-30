'use strict';
document.addEventListener('DOMContentLoaded', function() {
  var pageTitleNode = document.querySelector('.header .title a'),

    playbackSectionNode = document.querySelector('.playback.section'),
    titleNode = playbackSectionNode.querySelector('.title'),
    displayNode = playbackSectionNode.querySelector('.display'),
    playButtonNode = playbackSectionNode.querySelector('.play'),
    homeButtonNode = playbackSectionNode.querySelector('.home'),

    recordingSectionNode = document.querySelector('.recording.section'),
    recordingInputNode = recordingSectionNode.querySelector('[name="recording"]'),
    titleInputNode = recordingSectionNode.querySelector('[name="title"]'),
    resetButtonNode = recordingSectionNode.querySelector('.reset');

  pageTitleNode.addEventListener('click', function(event) {
    window.history.pushState('', '', '/');
    handleStateChange('');
    event.preventDefault();
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

  var dmp = new diff_match_patch();

  // Recording
  var tape = [],
    baseTime = null,
    previousValue = '';

  recordingInputNode.addEventListener('keydown', setTimeout.bind(window, updateTape.bind(recordingInputNode)));

  function updateTape() {
    if (this.value !== previousValue) {
      var currentValue = this.value,
        time = 0;
      if (baseTime === null) {
        baseTime = new Date().getTime();
      }
      else {
        time = new Date().getTime() - baseTime;
      }
      var diff = dmp.diff_main(previousValue, currentValue),
        patchList = dmp.patch_make(previousValue, currentValue, diff),
        patchText = dmp.patch_toText(patchList);
      tape.push({
        time: time,
        patch: patchText
      });
      previousValue = currentValue;
    }
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
    recordingInputNode.value = '';
    titleInputNode.value = '';
    previousValue = '';
    tape = [];
    baseTime = null;
  }

  // Playback
  var playbackId = 0;

  function playTape() {
    var currentPlaybackId = ++playbackId,
      tape = JSON.parse(displayNode.getAttribute('data-recording')).data;

    displayNode.value = '';

    function read() {
      if (currentPlaybackId === playbackId) {
        var currentFrameTime = new Date().getTime() - startTime;
        while (tape.length && currentFrameTime >= tape[0].time) {
          var head = tape.shift(),
            scrollDown = displayNode.scrollTop + displayNode.offsetHeight - 1 === displayNode.scrollHeight,
            patchList = dmp.patch_fromText(head.patch),
            patchedText = dmp.patch_apply(patchList, displayNode.value)[0];
          displayNode.value = patchedText;
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
