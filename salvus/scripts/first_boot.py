#!/usr/bin/env python

# This script is run by /etc/rc.local when booting up.  It does special configuration
# depending on what images are mounted, etc.

import os, socket, sys

hostname = socket.gethostname()

if hostname == "salvus-base":
    # no special config -- this is our template machine
    sys.exit(0)

# Enable swap
if not hostname.startswith('compute') and not hostname.startswith('cassandra'):   # no swap on cassandra -- http://www.datastax.com/documentation/cassandra/2.0/cassandra/install/installRecommendSettings.html
    os.system("swapon /dev/salvus-base/swap")

# Mount tmp
os.system("mount /dev/salvus-base/tmp /tmp; chmod +t /tmp; chmod a+rwx /tmp/")

if hostname.startswith('compute'):

    # Delete secrets that aren't needed for the *compute machines* (only web machines)
    os.system('rm -rf /home/salvus/salvus/salvus/data/secrets/cassandra')

    # Delete ssh private key not needed for the *compute machines*; not deleting this
    # would be a security risk, since this key could provide access to a database node
    # (say) to a user on the compute node who cracks the salvus account. As it is, there
    # is nothing stored on a compute node that directly gives access to any other
    # nodes.  The one dangerous thing is the tinc vpn private key, which gets the
    # machine on the VPN.  However, even that is destroyed when the machine is restarted
    # (at least at UW) and I think being on the vpn doesn't immediately provide a way
    # to break in; it's just a step.
    if 'dc' not in hostname:  # temporarily disable since we need this for migration3
        os.system('rm -rf /home/salvus/.ssh/id_rsa')

    # Restore existing user accounts
    if os.path.exists('/mnt/home/etc/'):
        os.system("cp -rv /mnt/home/etc/* /etc/")
    else:
        os.system("mkdir -p /mnt/home/etc/")

    # Store crontabs in persistent storage, so they don't vanish on VM restart
    if False:
        # disabled -- need to do something that takes into account how projects can move.  Pretty tricky.
        if not os.path.exists("/mnt/home/crontabs/"):
           os.system("mkdir -p /mnt/home/crontabs/; chmod a+rx /mnt/home/; chgrp crontab /mnt/home/crontabs; chmod 1730 /mnt/home/crontabs")
        os.system("cd /var/spool/cron/; rm -rf crontabs; ln -s /mnt/home/crontabs .")

    # Setup /tmp so it is on the external disk image (has that quota) and is clean, since this is a fresh boot.
    # os.system("rm -rf /mnt/home/tmp; mkdir -p /mnt/home/tmp/; chmod +t /mnt/home/tmp; mount -o bind /mnt/home/tmp /tmp; chmod a+rwx /mnt/home/tmp/")

    # Scratch is persistent but not backed up.
    #os.system("mkdir -p /mnt/home/scratch; mkdir -p /scratch; chmod +t /mnt/home/tmp; mount -o bind /mnt/home/scratch /scratch;  chmod a+rwx /mnt/home/scratch/")

    # Copy over newest version of certain scripts and set permissions
    for s in ['create_project_user.py', 'ensure_ssh_access.py', 'ensure_file_exists.py', 'compact_zvol', 'cgroup.py']:
        os.system("cp /home/salvus/salvus/salvus/scripts/%s /usr/local/bin/; chmod og-w /usr/local/bin/%s; chmod og+rx /usr/local/bin/%s"%(s,s,s))

    # Re-create the storage user
    os.system("groupadd -g 999 -o storage")
    os.system("useradd -u 999 -g 999 -o -d /home/storage storage")
    os.system("chown -R storage. /home/storage")
    os.system("chmod og-rwx -R /home/storage/&")

    # Copy over newest version of storage management script to storage user.
    os.system("cp /home/salvus/salvus/salvus/scripts/smc_storage.py /home/storage/; chown storage. /home/storage/smc_storage.py")

    # Remove the temporary ZFS send/recv streams -- they can't possibly be valid since we're just booting up.
    os.system("rm /home/storage/.storage*")

    # Import the ZFS pool -- without mounting!
    os.system("/home/salvus/salvus/salvus/scripts/mount_zfs_pools.py & ")

    # Start the storage server:
    if 'dc' in hostname:
        os.system("su - salvus /home/salvus/salvus/salvus/scripts/start_storage_server")

    else:
        # needed for migration
        os.system("cp /home/salvus/.ssh/authorized_keys /root/.ssh/")

else:

    # not a compute node, so no need for the storage account, which provides some ssh stuff we might not need...
    os.system('rm -rf /home/storage/')

# Lock down some perms a little, just in case I were to mess up somehow at some point
os.system("chmod og-rwx -R /home/salvus/&")


# Configure the backup machine(s)
if hostname.startswith('backup'):
    # create a /home/storage directory owned by salvus
    os.system("mkdir -p /home/storage; chown -R salvus. /home/storage")
    # delete the .ssh/authorized_keys file for the salvus user -- no passwordless login to backup vm's
    os.system("rm /home/salvus/.ssh/authorized_keys")
    # add lines to sudo control
    os.system("echo 'salvus ALL=(ALL) NOPASSWD: /sbin/zfs *' >> /etc/sudoers.d/salvus ")
    os.system("echo 'salvus ALL=(ALL) NOPASSWD: /sbin/zpool *' >> /etc/sudoers.d/salvus ")
    os.system("chmod 0440 /etc/sudoers.d/salvus ")
    # import the projects pool
    os.system("/home/salvus/salvus/salvus/scripts/mount_zfs_pools.py & ")


if hostname.startswith('cassandra'):
    # Delete data that doesn't need to be on this node
    os.system("rm -rf /home/salvus/salvus/salvus/data/secrets/")
    # import and mount the relevant ZFS pool -- do this blocking, since once the machine is up we had better
    # be able to start cassandra itself.
    os.system("zpool import -f cassandra ")

if hostname.startswith('compute'):
    # Create a firewall so that only the hub nodes can connect to things like ipython and the raw server.
    os.system("/home/salvus/salvus/salvus/scripts/compute_firewall.sh")






