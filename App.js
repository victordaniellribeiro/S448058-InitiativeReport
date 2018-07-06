Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
	launch: function() {
		//Write app code here

		//API Docs: https://help.rallydev.com/apps/2.1/doc/


		//gather all portfolioItem/Initiative based on current project
		// create a combo of all above (id<-> name)
		//print a combo of PortfolioItem/Initiative

		//upon selection, gather the following:
		//gather all children (portfolioItem/Feature)
		// for each children gather all stories

		// with all Stories data at hand create a pie chart based on ScheduleState:
		//"Unelaborated", "Defined", "In-Progress", "Completed", "Accepted", "Ready to Ship"

		var context = this.getContext();
		var project = context.getProject()['ObjectID'];

		console.log('project:', project);

		var filterPanel = Ext.create('Ext.panel.Panel', {
			layout: 'hbox',
			align: 'stretch',
			padding: 5,
			itemId: 'filterPanel',
		});

		var resultPanel = Ext.create('Ext.panel.Panel', {
			layout: 'hbox',
			align: 'stretch',
			padding: 5,
			itemId: 'resultPanel',
		});

		this.add(filterPanel);

		this.add(resultPanel);

		this.myMask = new Ext.LoadMask({
			msg: 'Please wait...',
			target: this
		});

		this._loadCombo().then({
			success: function(records) {
				//console.log('combo loaded', records);
				var initiativeComboBox = records;

				filterPanel.add(initiativeComboBox);
			},
			scope: this
		});



	},


	_loadCombo: function() {
		var deferred = Ext.create('Deft.Deferred');

		var initiativeStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'PortfolioItem/Initiative',
			fetch: ['FormattedID', 'Name', 'ObjectID', 'State'],
			limit: Infinity,
			filters: Rally.data.QueryFilter.and([{
				property: 'State',
				operator: '!=',
				value: ['Done']
			}, {
				property: 'State',
				operator: '!=',
				value: ['Measuring']
			}])
			//autoLoad: true,
		});

		initiativeStore.load().then({
			success: function(records) {
				console.log('records:', records);

				var newStore = Ext.create('Ext.data.Store', {
					fields: ['FormattedID', 'Name', 'ObjectID'],
					data: records
				});

				var combobox = Ext.create('Ext.form.ComboBox', {
					fieldLabel: 'Choose Initiative',
					width: 550,
					store: newStore,
					editable: true,
					anyMatch: true,
					queryMode: 'local',
					displayField: 'Name',
					triggerAction: 'all',
    				lastQuery: '',
					valueField: 'ObjectID',
					tpl: Ext.create('Ext.XTemplate',
						'<tpl for=".">',
						'<div class="x-boundlist-item">{FormattedID} - {Name}</div>',
						'</tpl>'
					),
					displayTpl: Ext.create('Ext.XTemplate',
						'<tpl for=".">',
						'{FormattedID} - {Name}',
						'</tpl>'
					),
					listeners: {
						select: function(combobox, records) {
							this.myMask.show();
							console.log(records[0]["data"]["ObjectID"]);
							this._loadStories(records[0]["data"]['ObjectID']);
						},
						scope: this
					}
				});
				deferred.resolve(combobox);
			},

			scope: this
		});

		return deferred.promise;
	},


	_loadStories: function(initiativeId) {
		var storiesStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'HierarchicalRequirement',
			context: {
				        projectScopeUp: false,
				        projectScopeDown: true,
				        project: null //null to search all workspace
			},
			fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'PortfolioItem', 'Parent'],
			filters: Rally.data.QueryFilter.or([{
				property: 'PortfolioItem.Parent.ObjectID',
				value: initiativeId
			}, {
				property: 'Parent.ObjectID',
				value: initiativeId
			}]),
			limit: Infinity
			//autoLoad: true,
		});

		storiesStore.load().then({
			success: function(records) {
				console.log('records:', records);
				//generate graph
				this._createPieChart(records);
			},
			scope: this
		});
	},


	_loadFeatures: function(featureIds) {
		var deferred = Ext.create('Deft.Deferred');
		console.log('looking for incomplete stories parents:', featureIds);

		var featureStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'PortfolioItem/Feature',
			context: {
				        projectScopeUp: false,
				        projectScopeDown: true,
				        project: null //null to search all workspace
			},
			fetch: ['FormattedID', 'Name', 'ObjectID', 'State', 'Project', 'PreliminaryEstimateValue', 'LeafStoryCount', 'AcceptedLeafStoryCount', 'LeafStoryPlanEstimateTotal', 'AcceptedLeafStoryPlanEstimateTotal'],
			filters: [{
                property: 'ObjectID',
                operator: 'in',
                value: featureIds
            }],
			limit: Infinity
			//autoLoad: true,
		});

		featureStore.load().then({
			success: function(records) {
				console.log('records:', records);
				deferred.resolve(records);
				
			},
			scope: this
		});

		return deferred.promise;
	},


	_generatePieChartData: function(stories) {
		var unelaborated = 0;
		var defined = 0;
		var inprogress = 0;
		var completed = 0;
		var accepted = 0;
		var ready = 0;
		var totalCount = 0;

		var unelaboratedPlanEstimate = 0;
		var definedPlanEstimate = 0;
		var inprogressPlanEstimate = 0;
		var completedPlanEstimate = 0;
		var acceptedPlanEstimate = 0;
		var readyPlanEstimate = 0;
		var totalPlanEstimate = 0;

		var data = [];

		Ext.Array.each(stories, function(story) {
			totalPlanEstimate += story.get('PlanEstimate');
			totalCount +=1;

			switch (story.get('ScheduleState')) {
				case 'Unelaborated':
					unelaborated += 1;
					unelaboratedPlanEstimate += story.get('PlanEstimate');
					break;
				case 'Defined':
					defined += 1;
					definedPlanEstimate += story.get('PlanEstimate');
					break;
				case 'In-Progress':
					inprogress += 1;
					inprogressPlanEstimate += story.get('PlanEstimate');
					break;
				case 'Completed':
					completed += 1;
					completedPlanEstimate += story.get('PlanEstimate');
					break;
				case 'Accepted':
					accepted += 1;
					acceptedPlanEstimate += story.get('PlanEstimate');
					break;
				case 'Ready to Ship':
					ready += 1;
					readyPlanEstimate += story.get('PlanEstimate');
					break;
			}
		});

		if (unelaborated > 0) {
			data.push({
				state: 'Unelaborated',
				count: unelaborated,
				planEstimate: unelaboratedPlanEstimate,
				percPlanned: Math.round(unelaboratedPlanEstimate / totalPlanEstimate * 100) + '%'
			});
		}

		if (defined > 0) {
			data.push({
				state: 'Defined',
				count: defined,
				planEstimate: definedPlanEstimate,
				percPlanned: Math.round(definedPlanEstimate / totalPlanEstimate * 100) + '%'
			});
		}

		if (inprogress > 0) {
			data.push({
				state: 'In-Progress',
				count: inprogress,
				planEstimate: inprogressPlanEstimate,
				percPlanned: Math.round(inprogressPlanEstimate / totalPlanEstimate * 100) + '%'
			});
		}

		if (completed > 0) {
			data.push({
				state: 'Completed',
				count: completed,
				planEstimate: completedPlanEstimate,
				percPlanned: Math.round(completedPlanEstimate / totalPlanEstimate * 100) + '%'
			});
		}

		if (accepted > 0) {
			data.push({
				state: 'Accepted',
				count: accepted,
				planEstimate: acceptedPlanEstimate,
				percPlanned: Math.round(acceptedPlanEstimate / totalPlanEstimate * 100) + '%'
			});
		}

		if (ready > 0) {
			data.push({
				state: 'Ready to Ship',
				count: ready,
				planEstimate: readyPlanEstimate,
				percPlanned: Math.round(readyPlanEstimate / totalPlanEstimate * 100) + '%'
			});
		}

		return data;
	},


	_generateSummaryData: function(stories) {
		var totalCount = 0;
		var totalPlanEstimate = 0;

		var data = this._generatePieChartData(stories);

		Ext.Array.each(stories, function(story) {
			totalPlanEstimate += story.get('PlanEstimate');
			totalCount +=1;
		});

		//Math.round(storeItem.get('count') / total * 100) + '%' + '\n Count: ' + storeItem.get('count')

		data.push({
			state: 'Total',
			count: totalCount,
			planEstimate: totalPlanEstimate
		});

		return data;
	},


	_getFeatureIdsOfIncompleteStories: function(stories) {
		var ids = [];

		Ext.Array.each(stories, function(story) {
			var state = story.get('ScheduleState');
			var parentId = story.get('Parent') != null ? story.get('Parent') : story.get('PortfolioItem').ObjectID;

			if (state != 'Accepted' && state != 'Ready to Ship') {
				console.log('In progress story: ', parentId, story);
				if (!Ext.Array.contains(ids, parentId)) {
					ids.push(parentId);
				}
			}
		});

		return ids;
	},


	_createFeatureSummaryReport: function(features) {
		var records;
		var featureIds = this._getFeatureIdsOfIncompleteStories(features);
		var promise = this._loadFeatures(featureIds);

		Deft.Promise.all([promise]).then({
			success: function(records) {
                console.log('promises:', records);

                var rows = [];
                Ext.Array.each(records[0], function(feature) {
                	rows.push({
						Feature: feature.get('FormattedID') +' - ' + feature.get('Name'),
						Project: feature.get('Project').Name,
						LeafStoryCount: feature.get('LeafStoryCount'),
						PreliminaryEstimateValue: feature.get('PreliminaryEstimateValue')
					});
                });

                this._createFeatureSummaryPanel(rows);
            }, scope: this
		});
	},


	_createPieChart: function(stories) {
		this.down('#resultPanel').removeAll(true);

		var store1 = Ext.create('Ext.data.JsonStore', {
			fields: ['state', 'count', 'planEstimate']
		});

		store1.loadData(this._generatePieChartData(stories));

		console.log('data', store1);

		var chart = Ext.create('Ext.chart.Chart', {
			xtype: 'chart',
			animate: true,
			store: store1,
			shadow: true,
			legend: {
				position: 'right'
			},
			insetPadding: 60,
			theme: 'Base:gradients',
			series: [{
				type: 'pie',
				//field: 'data1',
				angleField: 'count',
				showInLegend: true,
				donut: false,
				tips: {
					trackMouse: true,
					width: 140,
					height: 28,
					renderer: function(storeItem, item) {
						//calculate percentage.
						var total = 0;
						store1.each(function(rec) {
							total += rec.get('count');
						});
						this.setTitle(Math.round(storeItem.get('count') / total * 100) + '%' + '\n Count: ' + storeItem.get('count'));
					}
				},
				highlight: {
					segment: {
						margin: 20
					}
				},
				label: {
					field: 'state',
					display: 'rotate',
					contrast: true,
					font: '18px Arial'
				}
			}]
		});

		var resultPanel2 = Ext.create('Ext.panel.Panel', {
			width: 800,
			height: 500,
			title: 'Stories by ScheduleState',
			layout: 'fit',
			items: chart
		});


		this.down('#resultPanel').add(resultPanel2);
		this._createSummaryReport(stories);
		this._createFeatureSummaryReport(stories);
		
	},


	_createSummaryReport: function(stories) {
		var summaryStore = Ext.create('Ext.data.JsonStore', {
			fields: ['state', 'count', 'planEstimate', 'percPlanned']
		});

		summaryStore.loadData(this._generateSummaryData(stories));

		var summaryPanel = Ext.create('Ext.panel.Panel', {
			layout: 'vbox',
			align: 'stretch',
			padding: 5,
			itemId: 'summaryPanel',
		});

		var grid = Ext.create('Ext.grid.Panel', {
			store: summaryStore,
			height: 245,
			width: 450,
			title: 'Stories Count',
			viewConfig: {
				stripeRows: true,
				enableTextSelection: true
			},
			columns: [{
				text: 'State',
				flex: 1,
				sortable: false,
				dataIndex: 'state'
			}, {
				text: 'Count',
				width: 60,
				sortable: false,
				dataIndex: 'count'
			}, {
				text: 'Plan Estimate',
				width: 100,
				sortable: false,
				dataIndex: 'planEstimate'
			}, {
				text: '% Planned',
				width: 90,
				sortable: false,
				dataIndex: 'percPlanned'
			}]
		});

		summaryPanel.add(grid);
		this.down('#resultPanel').add(summaryPanel);
	},


	_createFeatureSummaryPanel: function(rows) {
		var featureStore = Ext.create('Ext.data.JsonStore', {
			fields: ['Feature', 'Project', 'LeafStoryCount', 'PreliminaryEstimateValue']
		});

		featureStore.loadData(rows);

		var featuresGrid = Ext.create('Ext.grid.Panel', {
			title: 'Features In-Progress',
			height: 245,
			width: 650,
			viewConfig: {
				stripeRows: true,
				enableTextSelection: true
			},
			store: featureStore,
			columns: [{
				text: 'Feature',
				flex: 2,
				sortable: false,
				dataIndex: 'Feature'
			}, {
				text: 'Project',
				flex: 1,
				sortable: false,
				dataIndex: 'Project'
			}, {
				text: 'Count',
				width: 60,
				sortable: false,
				dataIndex: 'LeafStoryCount'
			}, {
				text: 'Preliminary Estimate',
				width: 120,
				sortable: false,
				dataIndex: 'PreliminaryEstimateValue'
			}]
		});


		this.down('#summaryPanel').add(featuresGrid);

		this.myMask.hide();
	}	
});