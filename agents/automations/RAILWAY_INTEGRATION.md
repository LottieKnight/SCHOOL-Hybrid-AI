# Railway ↔ GitHub Integration Guide

Here is a direct breakdown of how to integrate Railway with GitHub, along with how to fix common permission issues like "No GitHub installation found".

---

## Step 1: Connect Railway to Your GitHub Account

1. Log into your **Railway Dashboard**.
2. Click on your profile icon in the top right corner and select **Account Settings**.
3. Navigate to **Integrations** on the left sidebar.
4. Click **Connect GitHub** and authorize Railway to access your account.

---

## Step 2: Configure Repository Permissions on GitHub

Railway needs explicit permission to access specific repositories or all repositories under your account.

1. Go to your [GitHub Installed Applications Settings](https://github.com/settings/installations).
2. Click **Configure** next to the **Railway App**.
3. Under **Repository Access**:
   - Select **All repositories**, or
   - Select **Only select repositories** and add your target repository (e.g., `LottieKnight/SCHOOL-Academic-Platform`).

4. Click **Save**.

---

## Step 3: Deploy a GitHub Repository on Railway

1. Open your project on Railway.
2. Click **+ New** (or **Add a Service**).
3. Select **GitHub Repo**.
4. Search for and select the repository you want to deploy.
5. Railway will automatically detect your stack, build the project, and trigger an initial deployment on every `git push` to your default branch.

---

## Fixing Common Connection Issues

If Railway shows an error like *`No GitHub installation found for repo`*:

1. **Verify App Access:** Ensure the Railway GitHub App is installed on the user/organization account that owns the repository.
2. **Re-sync Permissions:** Go to **Railway Settings → Integrations**, disconnect GitHub, and reconnect it to refresh access tokens.
3. **Check Repository Ownership:** If the repo belongs to an organization, an organization admin must grant permission for the Railway App to access it.
