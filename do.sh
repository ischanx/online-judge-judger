ip1=10.0.12.14
rsync_passwd_file=/etc/rsyncd.password

inotifywait -mrq --format '%Xe %w%f' -e create,move,attrib,modify /www/wwwroot/judge/sample | while read files
do
   echo $files 
   EVENT=`echo $files|awk -F" " '{print $1}'`
   echo $EVENT
   File=`echo $files|awk -F" " '{print $2}'`
   echo $File
   if [[ $EVENT = "CREATE" ]] || [[ $EVENT = "MODIFY" ]] || [[  $EVENT = "MOVED_TO" ]]  ;then
        echo "Create or Modify or Moved_to"
        rsync -avzcr --password-file=$rsync_passwd_file $(dirname $File) root@$ip1::test
   fi

   if [[ $EVENT = "DELETE" ]] || [[ $EVENT = "MOVED_FROM" ]] ;then
        echo "Delete or Moved_From"
        rsync -avzcr --delete --password-file=$rsync_passwd_file $(dirname $File) root@$ip1::test
   fi

   if [[ $EVENT = "ATTRIB" ]] ;then
        echo "Attribe"

        if [[ ! -d $File ]] ;then
            rsync -avzcr --password-file=$rsync_passwd_file $(dirname $File) root@$ip1::test
        fi
   fi
done