import * as dotenv from 'dotenv';
import * as Path from 'path';
import got from 'got';
import sharp from 'sharp';
import { 
	createWriteStream, 
	existsSync 
} from 'fs';
import fetch, {
	Blob,
	FormData,
	fileFromSync
} from 'node-fetch';

//configs
const config = dotenv.config();

//prevent duplicates and store reference data
const uploadedDigitalAssets = {
	//shopifyID:{...meta}
}

/**
 * grabProducts
 * Gets JSON payload of all the products parses them and then creates assets in OCM
 */
function grabProducts() {
	console.log('[grabProducts]')

	//set shopify headers
	const myHeaders = {
		'Content-Type': 'application/json',
		'X-Shopify-Access-Token': `${process.env.SHOPIFY_ACCESS_TOKEN}`,
	}
	
	//set request structure
	const requestOptions = {
	  method: 'GET',
	  redirect: 'follow',
	  headers: myHeaders,
	};

	//call products - add this to loop for more than 250 items
	const limit = 2;
	fetch(`${process.env.SHOPIFY_URL}${process.env.SHOPIFY_RELATIVE_PRODUCT_API}?limit=${limit}`, requestOptions)
	  .then(response => response.text())
	  .then(async (result) => {
		const data = JSON.parse(result)
		//console.log(data);

		//loop through product data
		await data.products.reduce(async (promise, product) => {
			await promise;
			console.log('[parsing product]',product);
			
			// check if product has a primary image and create digital asset in OCM
			let primaryImg = false;
			if (product.image) {
				primaryImg = await createDigitalAsset(product,product.image);
			}

			//check if product has a gallery and crete digital assets in OCM returning gallery arr to assign to prodoct
			let gallery = false;
			if ((product.images) && (product.images.length > 0)) {
				gallery = [];
				
				//loop through gallery and process 1 image at a time
				await product.images.reduce(async (promise, img) => {
					await promise;
					const galleryImg = await createDigitalAsset(product,img);
					gallery.push(galleryImg);
				}, Promise.resolve());
			}

			//Create Product asset type and add references
			await createAsset(product, primaryImg, gallery);

		}, Promise.resolve());
	  })
	  .catch(error => console.log('error', error));
	
}


/**
 * createDigitalAsset
 * Creates a digital asset in OCM and returns reference
 * @param {*} assetInfo product data
 * @param {*} image image data 
 * @returns OCM digital asset data
 */
async function createDigitalAsset(assetInfo,image) {
	console.log('[createDigitalAsset]',assetInfo);

	return new Promise(async (resolve, reject) => {
		//check if asset has been created and skip
		if (uploadedDigitalAssets[image.id]) {
			resolve(uploadedDigitalAssets[image.id]);
			return;
		} 

		//download set path to new asset and collect file extension
		const assetPath = await downloadImg(image.src);
		const filename = Path.basename(assetPath);
		const fileExtension = Path.extname(filename);

		//setup formdata for post
		const fd = new FormData();

		//asset meta info
		const fileMeta = JSON.stringify({
			name: filename.replace(/[&\/\\#,+()$~%'":;*?<>{}]/g,''),//strip invalid chars for OCM asset name
			type: `${process.env.OCM_Image_Type}`, //set Digital Asset type ie Image or Custom
			repositoryId: `${process.env.REPO}`, // OCM Repository to store digital asset
			//fields - if type = 'Image' then fields:{} empty object
			fields:{
				title: filename, // set title as asset filename
				alternatetext: image.alt || ' ', //try to grab alt data from shopify and set
			},
			'fileExtension': fileExtension, //define extension
			/*additional info to assign ie taxonomies, collection etc here if needed
			'collections': {
				'data': []
			},
			'tags': {
				'data': []
			},
			*/
		});

		//create metadata blob and assign to form data
		const blob = new Blob([fileMeta], {type: 'application/json'});
		fd.append('item', blob,'blob');

		//grab file and store in fd
		const theFile = fileFromSync(assetPath, `image/${fileExtension}`)
		fd.append('file', theFile, filename);
		
		//begin upload attempt
		try {
			await fetch(`${process.env.OCM_URL}/content/management/api/v1.1/items`, {
				method: 'post',
				headers: {
					//'Content-Type': 'application/json', //don't add
					//'Content-Type': 'multipart/form-data', //don't add
					'X-Requested-With': 'XMLHttpRequest',
					'Authorization': `Bearer ${process.env.OCM_TOKEN}`,
				},
				body: fd
			}).then((res) => {
				return res.json();
			}).then((json) => {
				//console.log(json);
				//store reference to image that it has been created - to prevent duplicates
				uploadedDigitalAssets[image.id] = json;

				resolve(json);
			});
			
		} catch (err) {
			console.error('[createDigitalAsset][post] err:', err);
			reject()
		}
	});
}


/**
 * downloadImg
 * Downloads images from commerce platform
 * @param {*} url 
 * @returns 
 */
async function downloadImg(url) {
	console.log('[downloadImg]',url);

	return new Promise(async (resolve, reject) => {
		//grab filename	
		const filename = Path.basename(url).split('?')[0];
		//console.log('--Filename: ',filename);

		//set asset path to download image to
		let assetPath = `src/media/${filename}`;

		//check if asset exists on fs if it doesn't stream download and save.
		if (!existsSync(assetPath)) {
			await streamDownload(url, assetPath);
		}

		//wait for asset to convert and return updated new path
		assetPath = await convert(assetPath);
		//console.log('..assetPath',assetPath);

		resolve(assetPath);
	});
}


/**
 * createAsset
 * Create the product asset type and add all data/assocations
 * @param {*} assetInfo 
 * @param {*} primaryImg 
 */
async function createAsset(product, primaryImg, gallery) {
	console.log('[createAsset]',product,primaryImg,gallery);

	return new Promise(async (resolve, reject) => {
		let params = {
			'name': product.title.replace(/[&\/\\#,+()$~%'":;*?<>{}]/g,''),//strip invalid chars for OCM asset name
			'slug': product.variants[0].sku, // add product sku
			'type': 'Product-SKU', //assing against product asset type
			//'description': '',
			'repositoryId': process.env.repo,
			//'language': '',
			//'translatable': '',
			'fields': {
				seo_title: product.title,
				asset_tags: product.tags,
				vendor_name: product.vendor,
				display_name: product.title,
			},
			/*additional info to assign ie taxonomies, collection etc here if needed
			'collections': {
				'data': [addCollection]
			},
			'channels': {
				'data': []
			},
			'tags': {
				'data': []
			},*/
		};

		//attach primary img reference
		if (primaryImg) {
			params.primary_image = {
				fileExtension: primaryImg.fileExtension,
				id:primaryImg.id,
				name:primaryImg.name,
				type:primaryImg.type,
			}
		}

		//attach gallery img references
		if ((gallery) && (gallery.length > 0)) {
			params.gallery = [];

			gallery.forEach((img) => {
				params.gallery.push({
					fileExtension: img.fileExtension,
					id:img.id,
					name:img.name,
					type:img.type,
				});
			});
			//console.log('[----GALLERY',params.gallery);
		}

		//try to create the product asset on OCM
		try {
			await fetch(`${process.env.OCM_URL}/content/management/api/v1.1/items`, {
				method: 'post',
				headers: {
					//'Content-Type': 'application/json',
					//'Content-Type': 'multipart/form-data',
					'Content-Type': 'application/json',
					'X-Requested-With': 'XMLHttpRequest',
					'Authorization': `Bearer ${process.env.OCM_TOKEN}`,
				},
				body: JSON.stringify(params),
			}).then((res) => {
				return res.json();
			}).then((json) => {
				console.log(json);
				resolve(json);
			});
			
		} catch (err) {
			console.error('[createAsset][post] err:', err);
			reject()
		}
	});
}


/**
 * streamDownload
 * Downloads an asset via http to local node env
 * @param {String} url URL to download from
 * @param {String} fileName file path & name to save download to
 * @returns {JSON} response body
 */
async function streamDownload(url, fileName) {
	console.log('[streamDownload]',url, fileName);

	return new Promise(async (resolve, reject) => {
		try {
			console.time(`Download_${fileName}`);
			const downloadStream = got.stream(url);
			const fileWriterStream = createWriteStream(fileName);

			//track progress of asset
			downloadStream.on('downloadProgress', ({ transferred, total, percent }) => {
				if (total) {
					const percentage = Math.round(percent * 100);
					console.log(`[streamDownload][${fileName}] Progress: ${transferred}/${total} (${percentage}%)`);
				//else server doesn’t return a Content-Length header for the file
				} else {
					console.log(`[streamDownload][${fileName}] Progress: ${transferred}`);
				}

			}).on('error', (error) => {
				console.error(`[streamDownload][${fileName}] Download failed: ${error.message}`);
				reject();
			});

			//track savind asset locally
			fileWriterStream.on('error', (error) => {
				console.error(`[streamDownload][${fileName}] Could not write file to system: ${error.message}`);
				reject();
			}).on('finish', () => {
				console.log(`[streamDownload][${fileName}] File downloaded to ${fileName}`);
				resolve();
			});

			//stream data to local file
			downloadStream.pipe(fileWriterStream);

		} catch (err) {
			console.error(`[streamDownload][${fileName}] Error at URL:`, url);
			console.error(`[streamDownload][${fileName}] err:`, err);
			reject();
		}
	});
}


/**
 * convert
 * Add any custom Image conversion logic
 * @param {String} assetPath file path to convert image
 * @returns {String} string path to converted image
 */
async function convert(assetPath) {

	return new Promise(async (resolve, reject) => {
		const outputPath = assetPath.replace(/media/g,'output');

		//convert image and change from progressive to lossless
		sharp(assetPath)
		.withMetadata() //keep all image data
		//.resize(300, 200)
		.toFile(outputPath, (err) => {
			if (err) {
				console.log('err:', err);
				reject();
			} else {
				resolve(outputPath);
			}
		});
	});
}

//init grab all products process and push to OCM
grabProducts();