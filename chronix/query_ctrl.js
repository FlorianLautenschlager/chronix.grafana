define([
        'angular',
        'lodash',
        'app/plugins/sdk'
    ],
    function (angular, _, sdk) {
        'use strict';

        var ChronixDBQueryCtrl = (function (_super) {
            var self;

            function ChronixDBQueryCtrl($scope, $injector) {
                _super.call(this, $scope, $injector);

                this.panel.stack = false;
                if (!this.panel.downsampling) {
                    this.panel.downsampling = 'avg';
                }
                if (!this.target.downsampling) {
                    this.target.downsampling = this.panel.downsampling;
                    this.target.sampling = this.panel.sampling;
                }
                this.target.errors = validateTarget(this.target);
                self = this;
            }

            ChronixDBQueryCtrl.prototype = Object.create(_super.prototype);
            ChronixDBQueryCtrl.prototype.constructor = ChronixDBQueryCtrl;

            ChronixDBQueryCtrl.templateUrl = 'partials/query.editor.html';

            ChronixDBQueryCtrl.prototype.targetBlur = function () {
                this.target.errors = validateTarget(this.target);
                if (!_.isEqual(this.oldTarget, this.target) && _.isEmpty(this.target.errors)) {
                    this.oldTarget = angular.copy(this.target);
                    this.panelCtrl.refresh();
                }
            };

            ChronixDBQueryCtrl.prototype.getTextValues = function (metricFindResult) {
                return _.map(metricFindResult, function (value) {
                    return value.text;
                });
            };

            ChronixDBQueryCtrl.prototype.suggestMetrics = function (query, callback) {
                self.datasource.metricFindQuery('metrics(' + query + ')')
                    .then(self.getTextValues)
                    .then(callback);
            };

            /**
             * =========================================================================
             *
             *  Join section
             *
             * =========================================================================
             */

            /**
             * Is called if someone types something into the join by box
             * @param query
             * @param callback
             */
            ChronixDBQueryCtrl.prototype.addJoinByAttribute = function (query, callback) {
                console.info("add join by attribute is called for " + query);

                self.datasource.suggestAttributes(query)
                    .then(self.getTextValues)
                    .then(callback);
            };


            /**
             * Is called if someone types something into a key field of an attribute
             * @param query
             * @param callback
             */
            ChronixDBQueryCtrl.prototype.suggestTagAttributes = function (query, callback) {
                console.log("suggestTagAttributes is called for " + query);

                self.datasource.suggestAttributes(query)
                    .then(self.getTextValues)
                    .then(callback);
            };

            ChronixDBQueryCtrl.prototype.validateJoinAttributes = function () {
                console.info("validateJoinAttributes is called");
                this.target.errors.attributes = null;
                if (!this.target.currentAttributeKey) {
                    this.target.errors.attributes = "You must specify a tag name and value.";
                }
            };


            /**
             * Is calls if someone removes a group by tag
             * @param attribute
             */
            ChronixDBQueryCtrl.prototype.removeJoinByAttribute = function (attribute) {
                console.info("removeJoinByAttribute is called for " + attribute);

               var index = this.target.attributes.indexOf(attribute);

                this.target.attributes.splice(index,1);

                if (_.size(this.target.attributes) === 0) {
                    this.target.attributes = null;
                }
                this.targetBlur();
            };


            /**
             * Add join by attribute
             */
            ChronixDBQueryCtrl.prototype.addJoinByAttribute = function () {
                console.info("addJoinByAttribute is called");
                if (!this.panel.addJoinAttributeMode) {
                    this.panel.addJoinAttributeMode = true;
                    this.validateJoinAttributes();
                    return;
                }

                if (!this.target.attributes) {
                    this.target.attributes = [];
                }

                this.validateJoinAttributes();
                if (!this.target.errors.attributes) {
                    this.target.attributes.push(this.target.currentAttributeKey);
                    this.target.currentAttributeKey = '';

                    this.targetBlur();
                }

                this.panel.addJoinAttributeMode = false;
            };



            /**
             * Is called if someone types something into a key field of an attribute
             * @param query
             * @param callback
             */
            ChronixDBQueryCtrl.prototype.suggestAttributes = function (query,callback) {
                console.log("Suggest tag key is called");

                self.datasource.suggestAttributes()
                    .then(self.getTextValues)
                    .then(callback);
            };

            /**
             * Is called if someone types something into a value field of an attribute
             * @param query
             * @param callback
             */
            ChronixDBQueryCtrl.prototype.suggestTagValues = function (query, callback) {
                console.log("Suggest available attribute values");

                self.datasource.suggestAttributesValues(self.target.metric, self.target.currentTagKey)
                    .then(self.getTextValues)
                    .then(callback);
            };


            // Filter metric by tag
            ChronixDBQueryCtrl.prototype.addFilterTag = function () {
                if (!this.panel.addFilterTagMode) {
                    this.panel.addFilterTagMode = true;
                    this.validateFilterTag();
                    return;
                }

                if (!this.target.tags) {
                    this.target.tags = {};
                }

                this.validateFilterTag();
                if (!this.target.errors.tags) {
                    if (!_.has(this.target.tags, this.target.currentTagKey)) {
                        this.target.tags[this.target.currentTagKey] = [];
                    }
                    this.target.tags[this.target.currentTagKey].push(this.target.currentTagValue);
                    this.target.currentTagKey = '';
                    this.target.currentTagValue = '';
                    this.targetBlur();
                }

                this.panel.addFilterTagMode = false;
            };

            ChronixDBQueryCtrl.prototype.removeFilterTag = function (key) {
                delete this.target.tags[key];
                if (_.size(this.target.tags) === 0) {
                    this.target.tags = null;
                }
                this.targetBlur();
            };

            ChronixDBQueryCtrl.prototype.validateFilterTag = function () {
                this.target.errors.tags = null;
                if (!this.target.currentTagKey || !this.target.currentTagValue) {
                    this.target.errors.tags = "You must specify a tag name and value.";
                }
            };

            //////////////////////////////
            // GROUP BY
            //////////////////////////////
            ChronixDBQueryCtrl.prototype.addGroupBy = function () {
                if (!this.panel.addGroupByMode) {
                    this.target.currentGroupByType = 'tag';
                    this.panel.addGroupByMode = true;
                    this.panel.isTagGroupBy = true;
                    this.validateGroupBy();
                    return;
                }
                this.validateGroupBy();
                // nb: if error is found, means that user clicked on cross : cancels input

                if (_.isEmpty(this.target.errors.groupBy)) {
                    if (this.panel.isTagGroupBy) {
                        if (!this.target.groupByTags) {
                            this.target.groupByTags = [];
                        }
                        if (!_.contains(this.target.groupByTags, this.target.groupBy.tagKey)) {
                            this.target.groupByTags.push(this.target.groupBy.tagKey);
                            this.targetBlur();
                        }
                        this.target.groupBy.tagKey = '';
                    }
                    else {
                        if (!this.target.nonTagGroupBys) {
                            this.target.nonTagGroupBys = [];
                        }
                        var groupBy = {
                            name: this.target.currentGroupByType
                        };
                        if (this.panel.isValueGroupBy) {
                            groupBy.range_size = this.target.groupBy.valueRange;
                        } else if (this.panel.isTimeGroupBy) {
                            groupBy.range_size = this.target.groupBy.timeInterval;
                            groupBy.group_count = this.target.groupBy.groupCount;
                        }
                        this.target.nonTagGroupBys.push(groupBy);
                    }
                    this.targetBlur();
                }

                this.panel.isTagGroupBy = false;
                this.panel.isValueGroupBy = false;
                this.panel.isTimeGroupBy = false;
                this.panel.addGroupByMode = false;
            };

            ChronixDBQueryCtrl.prototype.removeGroupByTag = function (index) {
                this.target.groupByTags.splice(index, 1);
                if (_.size(this.target.groupByTags) === 0) {
                    this.target.groupByTags = null;
                }
                this.targetBlur();
            };

            ChronixDBQueryCtrl.prototype.removeNonTagGroupBy = function (index) {
                this.target.nonTagGroupBys.splice(index, 1);
                if (_.size(this.target.nonTagGroupBys) === 0) {
                    this.target.nonTagGroupBys = null;
                }
                this.targetBlur();
            };

            ChronixDBQueryCtrl.prototype.changeGroupByInput = function () {
                this.panel.isTagGroupBy = this.target.currentGroupByType === 'tag';
                this.panel.isValueGroupBy = this.target.currentGroupByType === 'value';
                this.panel.isTimeGroupBy = this.target.currentGroupByType === 'time';
                this.validateGroupBy();
            };

            ChronixDBQueryCtrl.prototype.getValuesOfGroupBy = function (groupBy) {
                return _.values(groupBy);
            };

            ChronixDBQueryCtrl.prototype.validateGroupBy = function () {
                delete this.target.errors.groupBy;
                var errors = {};
                this.panel.isGroupByValid = true;
                if (this.panel.isTagGroupBy) {
                    if (!this.target.groupBy.tagKey) {
                        this.panel.isGroupByValid = false;
                        errors.tagKey = 'You must supply a tag name';
                    }
                }

                if (this.panel.isValueGroupBy) {
                    if (!this.target.groupBy.valueRange || !isInt(this.target.groupBy.valueRange)) {
                        errors.valueRange = "Range must be an integer";
                        this.isGroupByValid = false;
                    }
                }

                if (this.panel.isTimeGroupBy) {
                    try {
                        this.datasource.convertToChronixInterval(this.target.groupBy.timeInterval);
                    } catch (err) {
                        errors.timeInterval = err.message;
                        this.isGroupByValid = false;
                    }
                    if (!this.target.groupBy.groupCount || !isInt(this.target.groupBy.groupCount)) {
                        errors.groupCount = "Group count must be an integer";
                        this.isGroupByValid = false;
                    }
                }

                if (!_.isEmpty(errors)) {
                    this.target.errors.groupBy = errors;
                }
            };

            function isInt(n) {
                return parseInt(n) % 1 === 0;
            }


            //////////////////////////////
            // HORIZONTAL AGGREGATION
            //////////////////////////////

            ChronixDBQueryCtrl.prototype.addHorizontalAggregator = function () {
                if (!this.panel.addHorizontalAggregatorMode) {
                    this.panel.addHorizontalAggregatorMode = true;
                    this.target.currentHorizontalAggregatorName = 'avg';
                    this.panel.hasSamplingRate = true;
                    this.validateHorizontalAggregator();
                    return;
                }

                this.validateHorizontalAggregator();
                // nb: if error is found, means that user clicked on cross : cancels input
                if (_.isEmpty(this.target.errors.horAggregator)) {
                    if (!this.target.horizontalAggregators) {
                        this.target.horizontalAggregators = [];
                    }
                    var aggregator = {
                        name: this.target.currentHorizontalAggregatorName
                    };
                    if (this.panel.hasSamplingRate) {
                        aggregator.sampling_rate = this.target.horAggregator.samplingRate;
                    }
                    if (this.panel.hasUnit) {
                        aggregator.unit = this.target.horAggregator.unit;
                    }
                    if (this.panel.hasFactor) {
                        aggregator.factor = this.target.horAggregator.factor;
                    }
                    if (this.panel.hasPercentile) {
                        aggregator.percentile = this.target.horAggregator.percentile;
                    }
                    this.target.horizontalAggregators.push(aggregator);
                    this.targetBlur();
                }

                this.panel.addHorizontalAggregatorMode = false;
                this.panel.hasSamplingRate = false;
                this.panel.hasUnit = false;
                this.panel.hasFactor = false;
                this.panel.hasPercentile = false;
            };

            ChronixDBQueryCtrl.prototype.removeHorizontalAggregator = function (index) {
                this.target.horizontalAggregators.splice(index, 1);
                if (_.size(this.target.horizontalAggregators) === 0) {
                    this.target.horizontalAggregators = null;
                }

                this.targetBlur();
            };

            ChronixDBQueryCtrl.prototype.changeHorAggregationInput = function () {
                this.panel.hasSamplingRate = _.contains(['avg', 'dev', 'max', 'min', 'sum', 'least_squares', 'count', 'percentile'],
                    this.target.currentHorizontalAggregatorName);
                this.panel.hasUnit = _.contains(['sampler', 'rate'], this.target.currentHorizontalAggregatorName);
                this.panel.hasFactor = _.contains(['div', 'scale'], this.target.currentHorizontalAggregatorName);
                this.panel.hasPercentile = 'percentile' === this.target.currentHorizontalAggregatorName;
                this.validateHorizontalAggregator();
            };

            ChronixDBQueryCtrl.prototype.validateHorizontalAggregator = function () {
                delete this.target.errors.horAggregator;
                var errors = {};
                this.panel.isAggregatorValid = true;

                if (this.panel.hasSamplingRate) {
                    try {
                        this.datasource.convertToChronixInterval(this.target.horAggregator.samplingRate);
                    } catch (err) {
                        errors.samplingRate = err.message;
                        this.panel.isAggregatorValid = false;
                    }
                }

                if (this.hasFactor) {
                    if (!this.target.horAggregator.factor) {
                        errors.factor = 'You must supply a numeric value for this aggregator';
                        this.panel.isAggregatorValid = false;
                    }
                    else if (parseInt(this.target.horAggregator.factor) === 0 && this.target.currentHorizontalAggregatorName === 'div') {
                        errors.factor = 'Cannot divide by 0';
                        this.panel.isAggregatorValid = false;
                    }
                }

                if (this.panel.hasPercentile) {
                    if (!this.target.horAggregator.percentile ||
                        this.target.horAggregator.percentile <= 0 ||
                        this.target.horAggregator.percentile > 1) {
                        errors.percentile = 'Percentile must be between 0 and 1';
                        this.panel.isAggregatorValid = false;
                    }
                }

                if (!_.isEmpty(errors)) {
                    this.target.errors.horAggregator = errors;
                }
            };

            ChronixDBQueryCtrl.prototype.alert = function (message) {
                alert(message);
            };

            // Validation
            function validateTarget(target) {
                var errs = {};

                if (!target.metric) {
                    errs.metric = "You must supply a metric name.";
                }

                try {
                    if (target.sampling) {
                        self.datasource.convertToChronixInterval(target.sampling);
                    }
                } catch (err) {
                    errs.sampling = err.message;
                }

                return errs;
            }

            return ChronixDBQueryCtrl;

        })(sdk.QueryCtrl);

        return ChronixDBQueryCtrl;
    });
