aws --region us-east-1 cloudformation create-stack --stack-name behave-claude-apps-com --template-body file:///Volumes/Work/behave/stack.yaml --parameters ParameterKey=HostedZoneName,ParameterValue=claude-apps.com ParameterKey=HostedZoneId,ParameterValue=Z0033081161IG00XGJDLG ParameterKey=Hostname,ParameterValue=behave ParameterKey=PriceClass,ParameterValue=PriceClass_All --capabilities CAPABILITY_IAM