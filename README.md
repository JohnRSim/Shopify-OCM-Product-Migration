# Shopify-OCM-Product-Migration
Demo code providing a sample on how to quickly copy and map Product content from Shopify to Oracle Content Management.
For more info head over to https://bitmapbytes.com to read a blog post on the process.

https://bitmapbytes.com/shopify-product-content-migration-guide-to-ocm/

# Setup Env
Create .env file in the root project folder
```
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_URL=
SHOPIFY_RELATIVE_PRODUCT_API=
OCM_TOKEN=
OCM_URL=
OCM_Image_Type=Image
OCM_Product_Type=
REPO=
```

#### SHOPIFY_ACCESS_TOKEN
Your API Access token to make requests against the shopiy API only needs to be read access

#### SHOPIFY_URL
Path to your shopify site https://test.myshopify.com

#### SHOPIFY_RELATIVE_PRODUCT_API
Relative path to API ie. /admin/api/2022-07/products.json

#### OCM_TOKEN
You will need to goto your OCM environment and grab this from your browser
https://<instanceName>.cec.ocp.oraclecloud.com/documents/web?IdcService=GET_OAUTH_TOKEN

```
{

"LocalData": {
"IdcService": "GET_OAUTH_TOKEN",
"StatusCode": "0",
"StatusMessage": "You are logged in as 'xxx'.",
"StatusMessageKey": "!csUserLoggedIn,xxx",
"dUser": "xxx",
"dUserFullName": "OCM GenericAdmin",
"expiration": "604800",
"idcToken": "xx:xx",
"localizedForResponse": "1",
"refreshTokenValue": "xxxxx",
"tokenValue": "<xxxx_YOU NEED THIS VALUE>"
},


"ResultSets": {

}
}
```
Get the tokenValue key value.

#### OCM_URL
Your OCM domain ie. https://<instanceName>.cec.ocp.oraclecloud.com

#### OCM_Image_Type
Leave as the default Image digital asset type or create your own and supply additional field metadata for SEO, alt tags etc..\

#### OCM_Product_Type
This is the Custom Asset Type name that you want to assign and map data from Shopify to OCM 

#### REPO
Your OCM repository ID 

# Install modules required
```
npm install
```
# Modify
```
src/index.js
```
#### createDigitalAsset method
If you want to predefine tags, collections, taxonomy data or update field data mappings from shopify against the digital asset.

#### createAsset method
If you want to predefine tags, collections, taxonomy data against the asset or manage field data mappings from shopify against the asset.

#### convert method
If you want to preprocess the image before pushing it up to OCM.
I use sharp to convert the image you can view the docs here - https://sharp.pixelplumbing.com/api-constructor
- I convert the image from a progress to lossless due to limitations at this time with the OCM rendition (12/9/22) 


# Execute script
```
npm run migrate
```
