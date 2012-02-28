/**
 * @fileoverview Server-side magpo definition.
 */

var http = require('http');
var mongoose = require('mongoose');
var Word = require('../../models/word');
var Poem = require('../../models/poem');
var settings = require('../local');
var underscore = require('../../js/mylibs/underscore');
var url = require('url');

var MagPo = exports;

MagPo.name = 'magpo';

MagPo.attach = function() {
  /**
   * Loads a poem by id from persistant storage.
   *
   * @param {string} id
   *  The unique identifier for the poem.
   */
  this.loadPoem = function(id, callback) {
    // TODO - this is fragile, need to think about selecting all EXCEPT
    // the author.
    this.PoemModel.findOne({ _id: id }, ['_id', 'nid', 'words'], callback);
  };

  /**
   * Saves a poem to persistant storage.
   *
   * @param {object} poem
   *   A poem object to save to the database.
   */
  this.savePoem = function(poem, callback) {
    var self = this;
    var poemObj = new self.PoemModel();
    underscore(poem.words).each(function(wordObj) {
      var word = new self.WordModel();
      for (var y in wordObj) {
        word[y] = wordObj[y];
      }
      poemObj.words.push(word);
    });

    var poemTitle = '';
    underscore(poem.words).each(function(word) {
      poemTitle += word.string + ' ';
    });
    // TODO
    var poemString = 'bar';

    // TODO - figure out what to do if the author is set but is not the author
    // of the poem they're trying to update!
    // If the id exists and the author is set, try to update.
    if (typeof poem.id !== 'undefined' && poem.id != null && poem.author != null) {
      // TODO - this is fragile and assumes words is all we need to save.
      self.PoemModel.update(
        { _id: poem.id, author: poem.author },
        { $set: { words: poemObj.words } },
        function(err) {
          if (err) {
            callback(err, null);
            return;
          }
          callback(err, poem);

          // Update the poem in Drupal.
                    var post = JSON.stringify({
            title: poemTitle,
            body: poemString,
          });
console.log(post);
          var options = url.parse(settings.drupal.endpoint + 'n/' + poem.nid);
            options.method = 'PUT';
            options.headers = {
            'Content-Type': 'application/json',
            'Content-Length': post.length,
            'Cookie': self.cookie.session_name + '=' + self.cookie.sessid + ';',
          };
          var req = http.request(options, function saveRequest(res) {
            var data = '';
            res.on('data', function onData(chunk) {
              data += chunk;
            });
            res.on('end', function() {
              if (res.statusCode != 200) {
                console.error('Error (' + res.statusCode + ')');
                console.error(data);
                return;
              }
            });
          });
          req.write(post);
          req.end();
        }
      );
    }
    // Else it's a new one!
    else {
      // Generate a unique identifier that will be used to "authenticate" the
      // author. The only time this value is returned (for local storage) is
      // on initial save.
      if (typeof poem.author === 'undefined') {
        poemObj.author = require('node-uuid').v4();
      }
      else {
        poemObj.author = poem.author;
      }
      poemObj.save(function(err) {
        if (err) {
          callback(err, null);
        }
        poem.id = poemObj._id.__id;
        poem.author = poemObj.author;
        callback(err, poem);

        // Save the poem to Drupal.
        var post = JSON.stringify({
          title: poemTitle,
          type: 'poem',
          body: poemString,
          field_poem_unique_id: {
            und: [
              { value: poem.id }
            ]
          }
        });
        var options = url.parse(settings.drupal.endpoint + 'n');
        options.method = 'POST';
        options.headers = {
          'Content-Type': 'application/json',
          'Content-Length': post.length,
          'Cookie': self.cookie.session_name + '=' + self.cookie.sessid + ';',
        };
        var req = http.request(options, function saveRequest(res) {
          var data = '';
          res.on('data', function onData(chunk) {
            data += chunk;
          });
          res.on('end', function() {
            if (res.statusCode != 200) {
              console.error('Error (' + res.statusCode + ')');
              console.error(data);
              return;
            }

            // Update the nid in the database.
            data = JSON.parse(data);
            self.PoemModel.update(
              { _id: poem.id },
              { $set: { nid: data.nid }},
              {},
              function(err) {
                if (err) {
                  console.error(err);
                  return;
                }
              }
            );
          });
        });
        req.write(post);
        req.end();
      });
    }
  };

  /**
   * Removes a poem from persistant storage.
   *
   * @param {string} id
   *   The unique identifier for the poem.
   */
  this.removePoem = function(id, callback) {
    this.PoemModel.remove({ _id: id }, callback);
  };
};

MagPo.init = function(done) {
  var self = this;
  // Connect to the database.
  mongoose.connect(settings.db);

  // Make database specific changes here.
  var wordSchema = new mongoose.Schema(Word);
  self.WordModel = mongoose.model('Word', wordSchema);

  // We'll use mongo's built in hash ID, so remove it from our internal model.
  delete Poem.id;
  Poem.words = [ wordSchema ];
  var poemSchema = new mongoose.Schema(Poem);
  self.PoemModel = mongoose.model('Poem', poemSchema);

  // Log into Drupal.
  var post = JSON.stringify({
    username: settings.drupal.user,
    password: settings.drupal.password,
  });
  var options = url.parse(settings.drupal.endpoint + 'u/login');
  options.method = 'POST';
  options.headers = {
    'Content-Type': 'application/json',
    'Content-Length': post.length,
  };
  var req = http.request(options, function loginRequest(res) {
    var data = '';
    res.on('data', function onData(chunk) {
      data += chunk;
    });
    res.on('end', function onEnd() {
      if (res.statusCode != 200) {
        console.error('Error (' + res.statusCode + ')');
        console.error(data);
        // TODO - halt the application?
        return;
      }
      data = JSON.parse(data);
      self.cookie = {
        session_name: data.session_name,
        sessid: data.sessid,
      };
    });
  });
  req.write(post);
  req.end();

  return done();
};

MagPo.detach = function() {
  mongoose.connection.close();
};
