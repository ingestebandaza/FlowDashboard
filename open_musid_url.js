importClass(android.content.Intent);
importClass(android.net.Uri);

var url = "https://accounts.spotify.com/login/ott/music#token=lnLVyopQSku4ULe14JB1sQ\u0026passwordToken=po-DmyYsQvSNDwxDvcG2yA\u0026username=31nhd63qbnim2nmznmrygmtv75e4";
var pkg = "com.spotify.musid";

try {
  var intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
  intent.addCategory(Intent.CATEGORY_BROWSABLE);
  intent.setPackage(pkg);
  intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

  context.startActivity(intent);
  toast("Intent enviado a " + pkg);
  console.log("OK: Intent enviado a " + pkg + " url=" + url);
} catch (e) {
  toast("No se pudo abrir con musid");
  console.log("ERROR abriendo con musid: " + e);
}
