apt-get update

apt-get install curl
apt-get install build-essential
apt-get install git

#install node
apt-get -y purge nodejs*
curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -
apt-get install -y nodejs

npm -g install "https://github.com/thirdiron/promise-repl.git"

ln -sf /vagrant/dev/bash_profile /home/vagrant/.bash_profile


