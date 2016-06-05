apt-get update

apt-get install -y curl
apt-get install -y build-essential
apt-get install -y git

#install node
apt-get -y purge nodejs*
curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -
apt-get install -y nodejs

npm -g install "https://github.com/thirdiron/promise-repl.git"

ln -sf /vagrant/dev/bash_profile /home/vagrant/.bash_profile


