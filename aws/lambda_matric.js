//script CloudWatch matric send to elasticsearch
var http = require('https');
var AWS = require('aws-sdk');
AWS.config.region = 'ap-northeast-2';
var cw = new AWS.CloudWatch();
var ec2 = new AWS.EC2();

exports.handler = function(event, context) {

    var end = new Date();
    var start = new Date(end);
    start.setMinutes(end.getMinutes() - 5);

    ec2.describeInstances(function(err, data){
        for(var r=0,rlen=data.Reservations.length; r<rlen; r++) {
            var reservation = data.Reservations[r];
            for(var i=0,ilen=reservation.Instances.length; i<ilen; ++i) {
                var instance = reservation.Instances[i];
                var params = {
                    EndTime: end.toISOString(),
                    MetricName: 'MemoryUtilization',
                    Namespace: 'AWS/EC2',
                    Period: 300,
                    StartTime: start.toISOString(),
                    Dimensions: [
                        {
                            Name: 'InstanceId',
                            Value: instance.InstanceId
                        }],
                    Statistics: ['Average'],
                    Unit: 'Percent'
                };

                for(var t=0,tlen=instance.Tags.length; t<tlen; ++t) {
                    if(instance.Tags[t].Key === 'Name') {
                        var name = instance.Tags[t].Value;
                    }
                }
                cpu(params,name,instance.InstanceId);
            }
        }
    });
}

function cpu(params,name,id){
    cw.getMetricStatistics(params, function(err, data) {
        if (err) console.log(err, err.stack);
        else
            var max = 0;
        for(var r=0,rlen=data.Datapoints.length; r<rlen; r++) {
            if(max < data.Datapoints[r].Average){
                max = data.Datapoints[r].Average;
            }
        }
        putRequest(name,max,id);
    });
}

function putRequest(name, max, id){
    var post_data = JSON.stringify({
        'matric.appname' : 'ec2',
        'matric.message': 'matric',
        'matric.instanceId': id,
        'matric.name': name,
        'matric.max': max,
        'matric.type': 'CPUUtilization'

    });

    var post_options = {
        host: 'graylog.mealc.co.kr',
        port: 443,
        path: '/front/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    };

    var post_req = http.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });

    post_req.write(post_data);
    post_req.end();
}
