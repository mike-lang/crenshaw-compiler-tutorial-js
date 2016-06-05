# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "precise64"
  config.vm.box_url = "http://files.vagrantup.com/precise64.box"
  # Required for NFS to work, pick any local IP
  config.vm.network :private_network, ip: '192.168.255.255'
  config.vm.provision :shell, :path => "dev/provision.sh"

  config.vm.provider "virtualbox" do |v|
    v.memory = 1024
  end
end
