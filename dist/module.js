///<reference path="../node_modules/grafana-sdk-mocks/app/headers/common.d.ts" />
System.register(['app/core/config', 'app/core/app_events', 'app/plugins/sdk', 'lodash', 'moment'], function(exports_1) {
    var __extends = (this && this.__extends) || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
    var config_1, app_events_1, sdk_1, lodash_1, moment_1;
    var InfluxAdminCtrl;
    return {
        setters:[
            function (config_1_1) {
                config_1 = config_1_1;
            },
            function (app_events_1_1) {
                app_events_1 = app_events_1_1;
            },
            function (sdk_1_1) {
                sdk_1 = sdk_1_1;
            },
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            },
            function (moment_1_1) {
                moment_1 = moment_1_1;
            }],
        execute: function() {
            InfluxAdminCtrl = (function (_super) {
                __extends(InfluxAdminCtrl, _super);
                /** @ngInject **/
                function InfluxAdminCtrl($scope, $injector, templateSrv, $rootScope, $http, uiSegmentSrv) {
                    var _this = this;
                    _super.call(this, $scope, $injector);
                    this.defaults = {
                        mode: 'current',
                        query: 'SHOW DIAGNOSTICS',
                        options: {
                            database: null
                        },
                        time: 'YYYY-MM-DDTHH:mm:ssZ',
                        updateEvery: 1200
                    };
                    this.datasourceSrv = $injector.get('datasourceSrv');
                    this.uiSegmentSrv = uiSegmentSrv;
                    this.$http = $http;
                    this.templateSrv = templateSrv;
                    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
                    this.events.on('render', this.onRender.bind(this));
                    this.events.on('panel-initialized', this.onPanelInitalized.bind(this));
                    this.events.on('refresh', this.onRefresh.bind(this));
                    this.writing = false;
                    this.history = [];
                    // defaults configs
                    lodash_1.default.defaultsDeep(this.panel, this.defaults);
                    // All influxdb datasources
                    this.dbs = [];
                    lodash_1.default.forEach(config_1.default.datasources, function (val, key) {
                        if ("influxdb" == val.type) {
                            if (key == config_1.default.defaultDatasource) {
                                _this.dbs.unshift(key);
                            }
                            else {
                                _this.dbs.push(key);
                            }
                        }
                    });
                    // pick a datasource
                    if (lodash_1.default.isNil(this.panel.datasource)) {
                        if (this.dbs.length > 0) {
                            this.panel.datasource = this.dbs[0];
                        }
                    }
                    var txt = "default";
                    if (this.panel.options.database) {
                        txt = this.panel.options.database;
                    }
                    this.dbSeg = this.uiSegmentSrv.newSegment(txt);
                    this.queryInfo = {
                        last: 0,
                        count: 0,
                        queries: []
                    };
                    if (this.isShowCurrentQueries() && this.panel.updateEvery > 0) {
                        this.updateShowQueries();
                    }
                }
                InfluxAdminCtrl.prototype.isShowQueryWindow = function () {
                    return this.panel.mode == 'query';
                };
                InfluxAdminCtrl.prototype.isShowCurrentQueries = function () {
                    return this.panel.mode == 'current';
                };
                InfluxAdminCtrl.prototype.onInitEditMode = function () {
                    this.addEditorTab('Options', 'public/plugins/natel-influx-admin-panel/partials/editor.html', 1);
                    this.addEditorTab('Write Data', 'public/plugins/natel-influx-admin-panel/partials/write.html', 2);
                    this.editorTabIndex = 1;
                };
                InfluxAdminCtrl.prototype.writeData = function () {
                    var _this = this;
                    console.log("WRITE", this.writeDataText);
                    this.writing = true;
                    this.error = null;
                    return this.datasourceSrv.get(this.panel.datasource).then(function (ds) {
                        var db = _this.panel.options.database;
                        if (lodash_1.default.isNil(db)) {
                            db = ds.database;
                        }
                        _this.$http({
                            url: ds.urls[0] + '/write?db=' + db,
                            method: 'POST',
                            data: _this.writeDataText,
                            headers: {
                                "Content-Type": "plain/text"
                            }
                        }).then(function (rsp) {
                            _this.writing = false;
                            console.log("Wrote OK", rsp);
                        }, function (err) {
                            _this.writing = false;
                            console.log("Wite ERROR", err);
                            _this.error = err.data.error + " [" + err.status + "]";
                        });
                    });
                };
                InfluxAdminCtrl.prototype.askToKillQuery = function (qinfo) {
                    var _this = this;
                    app_events_1.default.emit('confirm-modal', {
                        title: 'Kill Influx Query',
                        text: 'Are you sure you want to kill this query?',
                        text2: qinfo.query,
                        icon: 'fa-trash',
                        //confirmText: 'yes',
                        yesText: 'Kill Query',
                        onConfirm: function () {
                            _this.datasourceSrv.get(_this.panel.datasource).then(function (ds) {
                                ds._seriesQuery('kill query ' + qinfo.id, _this.panel.options).then(function (res) {
                                    console.log('killed', qinfo, res);
                                });
                            });
                        }
                    });
                    return;
                };
                InfluxAdminCtrl.prototype.updateShowQueries = function () {
                    var _this = this;
                    this.datasourceSrv.get(this.panel.datasource).then(function (ds) {
                        ds._seriesQuery('SHOW QUERIES', _this.panel.options).then(function (data) {
                            var temp = [];
                            lodash_1.default.forEach(data.results[0].series[0].values, function (res) {
                                // convert the time (string) to seconds (so that sort works!)
                                var durr = res[3];
                                var unit = durr[durr.length - 1];
                                var mag = 0;
                                if (unit == 's') {
                                    mag = 1;
                                }
                                else if (unit == 'm') {
                                    mag = 60;
                                }
                                else if (unit == 'h') {
                                    mag = 60 * 60;
                                }
                                var secs = parseInt(durr.substring(0, durr.length - 1)) * mag;
                                if (secs == 0 && 'SHOW QUERIES' == res[1]) {
                                    // Don't include the current query
                                    _this.queryInfo.lastId = res[0];
                                }
                                else {
                                    temp.push({
                                        'secs': secs,
                                        'time': res[3],
                                        'query': res[1],
                                        'db': res[2],
                                        'id': res[0]
                                    });
                                }
                            });
                            _this.queryInfo.count++;
                            _this.queryInfo.last = Date.now();
                            _this.queryInfo.queries = temp;
                            // Check if we should refresh the view
                            if (_this.isShowCurrentQueries() && _this.panel.updateEvery > 0) {
                                _this.queryInfo.timer = _this.$timeout(function () {
                                    _this.updateShowQueries();
                                }, _this.panel.updateEvery);
                            }
                        });
                    });
                };
                InfluxAdminCtrl.prototype.dbChanged = function () {
                    var _this = this;
                    this.datasourceSrv.get(this.panel.datasource).then(function (ds) {
                        console.log("DB Changed", _this.dbSeg);
                        var db = _this.dbSeg.value;
                        if (db === ds.database || db === "default") {
                            _this.panel.options.database = null;
                        }
                        else {
                            _this.panel.options.database = db;
                        }
                        _this.configChanged();
                    });
                };
                InfluxAdminCtrl.prototype.configChanged = function () {
                    this.error = null;
                    if (this.isShowCurrentQueries()) {
                        this.updateShowQueries();
                    }
                    else {
                        this.onQueryChanged();
                    }
                };
                InfluxAdminCtrl.prototype.getDBsegs = function () {
                    var _this = this;
                    return this.datasourceSrv.get(this.panel.datasource).then(function (ds) {
                        return ds.metricFindQuery("SHOW DATABASES", _this.panel.options).then(function (data) {
                            var segs = [];
                            lodash_1.default.forEach(data, function (val) {
                                segs.push(_this.uiSegmentSrv.newSegment(val.text));
                            });
                            return segs;
                        }, function (err) {
                            console.log("TODO... error???", err);
                        });
                    });
                };
                InfluxAdminCtrl.prototype.getQueryHistory = function () {
                    return this.history;
                };
                InfluxAdminCtrl.prototype.getQueryTemplates = function () {
                    return [
                        { text: 'Show Databases', click: "ctrl.setQuery( 'SHOW DATABASES' );" },
                        { text: 'Create Database', click: "ctrl.setQuery( 'CREATE DATABASE &quot;db_name&quot;' );" },
                        { text: 'Drop Database', click: "ctrl.setQuery( 'DROP DATABASE &quot;db_name&quot;' );" },
                        { text: '--' },
                        { text: 'Show Measurements', click: "ctrl.setQuery( 'SHOW MEASUREMENTS' );" },
                        { text: 'Show Field Keys', click: "ctrl.setQuery( 'SHOW FIELD KEYS FROM &quot;measurement_name&quot;' );" },
                        { text: 'Show Tag Keys', click: "ctrl.setQuery( 'SHOW TAG KEYS FROM &quot;measurement_name&quot;' );" },
                        { text: 'Show Tag Values', click: "ctrl.setQuery( 'SHOW TAG VALUES FROM &quot;measurement_name&quot; WITH KEY = &quot;tag_key&quot;' );" },
                        { text: 'Drop Measurement', click: "ctrl.setQuery( 'DROP MEASUREMENT &quot;measurement_name&quot;' );" },
                        { text: '--' },
                        { text: 'Show Retention Policies', click: "ctrl.setQuery( 'SHOW RETENTION POLICIES ON &quot;db_name&quot;' );" },
                        { text: 'Create Retention Policy', click: "ctrl.setQuery( 'CREATE RETENTION POLICY &quot;rp_name&quot; ON &quot;db_name&quot; DURATION 30d REPLICATION 1 DEFAULT' );" },
                        { text: 'Drop Retention Policy', click: "ctrl.setQuery( 'DROP RETENTION POLICY &quot;rp_name&quot; ON &quot;db_name&quot;' );" },
                        { text: '--' },
                        { text: 'Show Continuous Queries', click: "ctrl.setQuery( 'SHOW CONTINUOUS QUERIES' );" },
                        { text: 'Create Continuous Query', click: "ctrl.setQuery( 'CREATE CONTINUOUS QUERY &quot;cq_name&quot; ON &quot;db_name&quot; BEGIN SELECT min(&quot;field&quot;) INTO &quot;target_measurement&quot; FROM &quot;current_measurement&quot; GROUP BY time(30m) END' );" },
                        { text: 'Drop Continuous Query', click: "ctrl.setQuery( 'DROP CONTINUOUS QUERY &quot;cq_name&quot; ON &quot;db_name&quot;' );" },
                        { text: '--' },
                        { text: 'Show Users', click: "ctrl.setQuery( 'SHOW USERS' );" },
                        //  { text: 'Create User',       click: "ctrl.query = 'CREATE USER &quot;username&quot; WITH PASSWORD &apos;password&apos;" },
                        //  { text: 'Create Admin User', click: "ctrl.query = 'CREATE USER &quot;username&quot; WITH PASSWORD 'password' WITH ALL PRIVILEGES" },
                        { text: 'Drop User', click: "ctrl.setQuery( 'DROP USER &quot;username&quot;' );" },
                        { text: '--' },
                        { text: 'Show Stats', click: "ctrl.setQuery( 'SHOW STATS' );" },
                        { text: 'Show Diagnostics', click: "ctrl.setQuery( 'SHOW DIAGNOSTICS' );" }
                    ];
                };
                InfluxAdminCtrl.prototype.setQuery = function (txt) {
                    this.panel.query = txt;
                    this.onQueryChanged();
                };
                InfluxAdminCtrl.prototype.isClickableQuery = function () {
                    if ("SHOW DATABASES" == this.panel.query) {
                        return true;
                    }
                    if ("SHOW MEASUREMENTS" == this.panel.query) {
                        return true;
                    }
                    if (this.panel.query.startsWith('SHOW FIELD KEYS FROM "')) {
                        return true;
                    }
                    return false;
                };
                InfluxAdminCtrl.prototype.onClickedResult = function (res) {
                    console.log("CLICKED", this.panel.query, res);
                    if ("SHOW DATABASES" == this.panel.query) {
                        this.panel.query = 'SHOW MEASUREMENTS';
                        this.dbSeg = this.uiSegmentSrv.newSegment(res[0]);
                        this.dbChanged();
                    }
                    else if ("SHOW MEASUREMENTS" == this.panel.query) {
                        this.setQuery('SHOW FIELD KEYS FROM "' + res[0] + '"');
                    }
                    else if (this.panel.query.startsWith('SHOW FIELD KEYS FROM "')) {
                        var str = this.panel.query.split(/"/)[1];
                        this.setQuery('SELECT "' + res[0] + '" FROM "' + str + '" ORDER BY time desc LIMIT 10');
                    }
                    return;
                };
                InfluxAdminCtrl.prototype.isPostQuery = function () {
                    var q = this.panel.query;
                    return !(q.startsWith("SELECT ") ||
                        q.startsWith("SHOW "));
                };
                InfluxAdminCtrl.prototype.onQueryChanged = function () {
                    console.log("onQueryChanged()", this.panel.query);
                    this.rsp = null;
                    if (!this.isPostQuery()) {
                        this.doSubmit();
                    }
                    else {
                        console.log("POST query won't submit automatically");
                    }
                };
                InfluxAdminCtrl.prototype.doSubmit = function () {
                    var _this = this;
                    var q = this.panel.query;
                    this.history.unshift({ text: q, value: q }); // Keep the template variables
                    for (var i = 1; i < this.history.length; i++) {
                        if (this.history[i].value === q) {
                            this.history.splice(i, 1);
                            break;
                        }
                    }
                    if (this.history.length > 15) {
                        this.history.pop();
                    }
                    this.q = this.templateSrv.replace(q, this.panel.scopedVars);
                    console.log("doSubmit()", this.q);
                    var startTime = Date.now();
                    this.error = null;
                    this.clickableQuery = false;
                    this.runningQuery = true;
                    this.datasourceSrv.get(this.panel.datasource).then(function (ds) {
                        //console.log( 'doSubmit >>>', ds, this.panel.query, this.panel.options);
                        ds._seriesQuery(_this.q, _this.panel.options).then(function (data) {
                            _this.runningQuery = false;
                            _this.queryTime = (Date.now() - startTime) / 1000.0;
                            _this.clickableQuery = _this.isClickableQuery();
                            // Process the timestamps
                            lodash_1.default.forEach(data.results, function (query) {
                                lodash_1.default.forEach(query, function (res) {
                                    lodash_1.default.forEach(res, function (series) {
                                        if (series.columns && series.columns[0] == 'time') {
                                            lodash_1.default.forEach(series.values, function (row) {
                                                row[0] = moment_1.default(row[0]).format(_this.panel.time);
                                            });
                                        }
                                    });
                                });
                            });
                            // Set this after procesing the timestamps
                            _this.rsp = data;
                        }, function (err) {
                            // console.log( 'ERROR with series query', err );
                            _this.runningQuery = false;
                            _this.clickableQuery = false;
                            _this.error = err.message;
                            _this.queryTime = (Date.now() - startTime) / 1000.0;
                        });
                    });
                };
                InfluxAdminCtrl.prototype.onPanelInitalized = function () {
                    //console.log("onPanelInitalized()")
                    this.onQueryChanged();
                };
                InfluxAdminCtrl.prototype.onRender = function () {
                    //console.log("onRender");
                };
                InfluxAdminCtrl.prototype.onRefresh = function () {
                    if (this.isShowCurrentQueries()) {
                        this.updateShowQueries();
                    }
                    //console.log("onRefresh");
                };
                InfluxAdminCtrl.templateUrl = 'partials/module.html';
                return InfluxAdminCtrl;
            })(sdk_1.PanelCtrl);
            exports_1("PanelCtrl", InfluxAdminCtrl);
        }
    }
});
//# sourceMappingURL=module.js.map