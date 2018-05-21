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
			target: resultPanel
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
			fetch: ['FormattedID', 'Name', 'ObjectID'],
			//autoLoad: true,
		});

		initiativeStore.load().then({
			success: function(records) {
				//console.log('records:', records);

				var newStore = Ext.create('Ext.data.Store', {
					fields: ['FormattedID', 'Name', 'ObjectID'],
					data: records
				});

				var combobox = Ext.create('Ext.form.ComboBox', {
					fieldLabel: 'Choose Initiative',
					width: 550,
					store: newStore,
					queryMode: 'remote',
					//displayField: 'FormattedID',
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
			fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState'],
			filters: Rally.data.QueryFilter.or([{
				property: 'PortfolioItem.Parent.ObjectID',
				value: initiativeId
			}, {
				property: 'Parent.ObjectID',
				value: initiativeId
			}])
			//autoLoad: true,
		});

		storiesStore.load().then({
			success: function(records) {
				//console.log('records:', records);
				//generate graph
				this._createPieChart(records);
			},
			scope: this
		});
	},

	_generateData: function(stories) {
		var unelaborated = 0;
		var defined = 0;
		var inprogress = 0;
		var completed = 0;
		var accepted = 0;
		var ready = 0;

		var data = [];

		Ext.Array.each(stories, function(story) {
			switch (story.get('ScheduleState')) {
				case 'Unelaborated':
					unelaborated += 1;
					break;
				case 'Defined':
					defined += 1;
					break;
				case 'In-Progress':
					inprogress += 1;
					break;
				case 'Completed':
					completed += 1;
					break;
				case 'Accepted':
					accepted += 1;
					break;
				case 'Ready to Ship':
					ready += 1;
					break;
			}
		});

		if (unelaborated > 0) {
			data.push({
				state: 'Unelaborated',
				data1: unelaborated
			});
		}

		if (defined > 0) {
			data.push({
				state: 'Defined',
				data1: defined
			});
		}

		if (inprogress > 0) {
			data.push({
				state: 'In-Progress',
				data1: inprogress
			});
		}

		if (completed > 0) {
			data.push({
				state: 'Completed',
				data1: completed
			});
		}

		if (accepted > 0) {
			data.push({
				state: 'Accepted',
				data1: accepted
			});
		}

		if (ready > 0) {
			data.push({
				state: 'Ready to Ship',
				data1: ready
			});
		}

		return data;
	},


	_createPieChart: function(stories) {
		this.down('#resultPanel').removeAll(true);

		var store1 = Ext.create('Ext.data.JsonStore', {
			fields: ['state', 'data1']
		});

		store1.loadData(this._generateData(stories));

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
				angleField: 'data1',
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
							total += rec.get('data1');
						});
						this.setTitle(Math.round(storeItem.get('data1') / total * 100) + '%' + '\n Count: ' + storeItem.get('data1'));
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
			height: 600,
			title: 'Stories by ScheduleState',
			layout: 'fit',
			items: chart
		});


		this.down('#resultPanel').add(resultPanel2);

		var grid = Ext.create('Ext.grid.Panel', {
			store: store1,
			height: 250,
			width: 250,
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
				text: 'Cout',
				width: 75,
				sortable: false,
				dataIndex: 'data1'
			}]
		});

		this.down('#resultPanel').add(grid);

		this.myMask.hide();
	}

});