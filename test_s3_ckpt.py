import boto3

s3 = boto3.client('s3',
    endpoint_url='https://s3.us-east-va.perf.cloud.ovh.us',
    aws_access_key_id='b6939e6b65ef4252b20338499421a5f0',
    aws_secret_access_key='4a7e939381c6467c88f81a5024672a96',
    region_name='us-east-va'
)

paginator = s3.get_paginator('list_objects_v2')
pages = paginator.paginate(Bucket='pixel-data')

for page in pages:
    for obj in page.get('Contents', []):
        if 'wayfarer' in obj['Key'] or 'ckpt' in obj['Key'] or 'checkpoint' in obj['Key'] or 'stage1' in obj['Key']:
            print(obj['Key'])

