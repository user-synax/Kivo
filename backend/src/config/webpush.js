import webpush from "web-push";
import env from "./env.js";

webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);

export default webpush;
