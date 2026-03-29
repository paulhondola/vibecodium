sudo rm -rf /tmp/vibecodium

sudo mkdir -p /tmp/vibecodium
sudo chown -R $USER:$USER /tmp/vibecodium
sudo chmod -R 777 /tmp/vibecodium

sudo usermod -aG docker $USER

bun run dev