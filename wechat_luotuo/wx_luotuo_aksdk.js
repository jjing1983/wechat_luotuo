//TODO 替换对应参数
var config = {
    game_id: '112',
    game_pkg: 'jzxjz_jzlywfjyltxyx_AYD',
    partner_label: 'luotuo',
    partner_id: '301',
    game_ver: '1.0.0',
    is_auth: false, //授权登录
    appid: 'wx300e68ad5c0a7406',
    partner_app_id: 6005,
    partner_token: 'tjp1605144781',
    partner_channel_id: 'daf04bc45e15f24a4c4faa2ba344144b'
};
var PARTNER_SDK = mainSDK();
var HOST = 'sdk.sh9130.com';
var user_game_info = null;
var user_invite_info = null;
var partner_data={};
var init_query = '';

function mainSDK() {
    var callbacks = {};
    return {
        order_data: {},
        init: function (ops, callback) {
            var game_ver = ops && ops.game_ver ? ops.game_ver : 0;
            console.log("[SDK]CP调用init接口");
            var self = this;

            var uuid = wx.getStorageSync('plat_uuid');
            var is_new;
            if (!uuid) {
                uuid = self.uuid(16, 32);
                wx.setStorageSync('plat_uuid', uuid);
                is_new = 1;
            } else {
                is_new = 0;
            }
            var idfv = wx.getStorageSync('plat_idfv');
            if (!idfv) {
                idfv = self.uuid(16, 32);
                wx.setStorageSync('plat_idfv', idfv);
            }


            var info = wx.getLaunchOptionsSync();
            var scene = info.scene ? info.scene : '';
            init_query = info.query ? JSON.stringify(info.query) : '';

            //判断今天是否已经上报过
            if (is_new && info.query && info.query.ad_code) {
                wx.setStorageSync('plat_ad_code', info.query.ad_code);
            }

            var data = {
                install: is_new,
                scene: scene
            };
            self.log('start', data);

            //玩家是分享过来的，单独上报给服务器
            var invite = info.query && info.query.invite ? info.query.invite : '';
            var invite_type = info.query && info.query.invite_type ? info.query.invite_type : '';

            if (invite) {
                user_invite_info = {
                    invite: invite,
                    invite_type: invite_type,
                    is_new: is_new,
                    scene: scene
                };
            }
            wx.showShareMenu({withShareTicket: true});

            //判断版本号
            if (game_ver) {
                this.checkGameVersion(game_ver, function (data) {
                    self.getMinGameInfo(function (res) {
                        if(res){
                            config.jump_appid = res.appid;
                            config.jump_path = res.path;
                            if(res.data==3003 && res.close_ios==1){
                                data.show_pay = 2;
                            }else if(res.data==3003){
                                data.show_pay = 0;
                            }else{
                                data.show_pay = 1;
                            }
                        }else{
                            data.show_pay = 1;
                        }
                        callback && callback(data);
                    });

                });
            }

        },

        getMinGameInfo: function(callback){
            wx.request({
                url: 'https://gameluotuo.cn/index.php?g=Wap&m=Wxa&a=get_audit_status&id=' + config.partner_app_id + '&token=' + config.partner_token,
                method: 'GET',
                dataType: 'json',
                data: {},
                success: function (res) {
                    console.log("[SDK]小游戏信息：", res);
                    if (res.statusCode === 200) {
                        callback(res.data);
                    }else{
                        callback({});
                    }
                }
            });
        },

        //TODO 替换联运登录接口
        login: function (data,callback) {
            var self = this;
            console.log("[SDK]调起登录");
            callbacks['login'] = typeof callback == 'function' ? callback : null;
            wx.login({
                success (res) {
                    console.log('wx登录回调：' , res)
                    if (res.code) {
                        wx.request({
                            url: 'https://gameluotuo.cn/index.php?g=Wap&m=Wxaapi&a=login',
                            method: 'GET',
                            dataType: 'json',
                            data: {
                                token:config.partner_token,
                                code:res.code,
                                channel_id:config.partner_channel_id,
                            },
                            success: function (res) {
                                console.log("[SDK]登录回调结果：", res);
                                if (res.statusCode === 200 && res.data.status===1001) {
                                    self.do_login(res.data);
                                }else{
                                    callbacks['login'] && callbacks['login'](1, {errMsg: '登录失败'});
                                }
                            }
                        });
                    } else {
                        
                        callbacks['login'] && callbacks['login'](1, {errMsg: res.errMsg});
                    }
                }
            });
            

        },


        do_login: function (info) {
            var self = this;
            partner_data = {
                session_3rd : info.session_3rd,
                scene : init_query
            };
            var public_data = self.getPublicData();
            public_data['is_from_min'] = 1;
            public_data['partner_data'] = JSON.stringify(partner_data);
            if (user_invite_info && typeof user_invite_info == 'object') {
                for (var key in user_invite_info) {
                    public_data[key] = user_invite_info[key];
                }
            }

            //发起网络请求
            wx.request({
                url: 'https://' + HOST + '/partner/auth',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: public_data,
                success: function (res) {
                    console.log("[SDK]登录结果：",res);
                    if (res.statusCode === 200) {
                        var data = res.data;
                        if (data.state) {
                            try {
                                wx.setStorageSync('plat_sdk_token', data.data.sdk_token);
                                wx.setStorageSync('plat_uid', data.data.user_id);
                                wx.setStorageSync('plat_username', data.data.username);
                                wx.setStorageSync('plat_openid', data.data.openid);
                                if(data.data.ext){
                                    wx.setStorageSync('plat_session_key', data.data.ext);
                                }
                            } catch (e) {
                            }
                            var userData = {
                                userid: data.data.user_id,
                                account: data.data.nick_name,
                                token: data.data.token,
                                invite_uid: data.data.invite_uid || '',
                                invite_nickname: data.data.invite_nickname || '',
                                invite_head_img: data.data.invite_head_img || '',
                                head_img: data.data.head_img || '',
                                is_client: data.data.is_client || '0',
                                ios_pay: data.data.ios_pay || '0'
                            };
                            callbacks['login'] && callbacks['login'](0, userData);
                        } else {
                            callbacks['login'] && callbacks['login'](1, {errMsg: data.msg});
                        }

                        //登录成功，加载右上角分享数据
                        self.getShareInfo('menu', function (data) {
                            console.log("[SDK]开始监听右上角菜单分享");
                            self.setChannelShare(data,'menu');
                        });

                    } else {
                        callbacks['login'] && callbacks['login'](1, {
                            errMsg: '请求平台服务器失败！'
                        });
                    }
                }
            });

        },

        share: function (data) {
            var type = data.type || 'share';
            console.log("[SDK]CP调用分享 type=" + type);
            var self = this;

            this.getShareInfo(type, function (data) {
                self.logStartShare(type);
                //记录开始分享
                self.setChannelShare(data, type);
                
            });

        },

        setChannelShare: function (data , type) {
            var self = this;
            wx.request({
                url: 'https://gameluotuo.cn/index.php?g=Wap&m=Wxaapi&a=game_share',
                method: 'GET',
                dataType: 'json',
                data: {
                    token:config.partner_token,
                    session_3rd:partner_data.session_3rd,
                    channel_id:config.partner_channel_id,
                },
                success: function (res) {
                    console.log("[SDK]获取渠道分享信息回调结果：", res);
                    if (res.statusCode === 200 && res.data.status===1001) {
                        if(type==='share'){
                            wx.shareAppMessage({
                                title: res.data.info.title,
                                imageUrl: res.data.info.imgUrl,
                                query: data.query,
                            });
                        }else{
                            wx.onShareAppMessage(function () {
                                //记录开始分享
                                self.logStartShare('menu');
                                return {
                                    title:  res.data.info.title,
                                    imageUrl:  res.data.info.imgUrl,
                                    query: data.query,
                                }
                            });
                        }
                         
                    }else{
                        if(type==='share'){
                            wx.shareAppMessage({
                                title: data.title,
                                imageUrl: data.img,
                                query: data.query,
                            });
                        }else{
                            wx.onShareAppMessage(function () {
                                //记录开始分享
                                self.logStartShare('menu');
                                return {
                                    title: data.title,
                                    imageUrl: data.img,
                                    query: data.query,
                                }
                            });
                        }
                        
                    }
                }
            });
        },

        logStartShare: function (type) {
            var sdk_token = wx.getStorageSync('plat_sdk_token');
            wx.request({
                url: 'https://' + HOST + '/game/min/?ac=logStartShare',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: {
                    game_pkg: config.game_pkg,
                    partner_id: config.partner_id,
                    sdk_token: sdk_token,
                    server_id: user_game_info ? user_game_info.server_id : '',
                    role_id: user_game_info ? user_game_info.role_id : '',
                    type: type,
                },
                success: function (res) {}
            });
        },

        openService: function () {
            wx.openCustomerServiceConversation();
        },

        checkGameVersion: function (game_ver, callback) {
            console.log("[SDK]检查游戏版本");
            var sdk_token = wx.getStorageSync('plat_sdk_token');
            wx.request({
                url: 'https://' + HOST + '/game/min/?ac=checkGameVersion',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: {
                    game_pkg: config.game_pkg,
                    partner_id: config.partner_id,
                    game_ver: game_ver
                },
                success: function (res) {
                    console.log("[SDK]获取游戏版本结果");
                    console.log(res);
                    if (res.statusCode == 200) {
                        var data = res.data;
                        if (data.state) {
                            callback && callback(data.data);
                        } else {
                            callback && callback({
                                develop: 0
                            });
                        }
                    } else {
                        callback && callback({
                            develop: 0
                        });
                    }
                }
            });
        },
        getShareInfo: function (type, callback) {
            console.log("[SDK]获取分享参数");
            var sdk_token = wx.getStorageSync('plat_sdk_token');
            wx.request({
                url: 'https://' + HOST + '/game/min/?ac=shareConfig',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: {
                    game_pkg: config.game_pkg,
                    partner_id: config.partner_id,
                    sdk_token: sdk_token,
                    type: type,
                    server_id: user_game_info ? user_game_info.server_id : '',
                    role_id: user_game_info ? user_game_info.role_id : '',
                    no_log: 1 //设置为1后就不在这个接口打log，交给logStartShare接口
                },
                success: function (res) {
                    console.log("[SDK]获取分享参数结果");
                    console.log(res);
                    if (res.statusCode == 200) {
                        var data = res.data;
                        if (data.state) {
                            callback && callback(data.data);
                        } else {
                            callbacks['share'] && callbacks['share'](1, {
                                errMsg: '分享失败：' + data.msg
                            });
                        }
                    } else {
                        callbacks['share'] && callbacks['share'](1, {
                            errMsg: '获取分享数据失败！'
                        });
                    }
                }
            });
        },

        updateShare: function (invite, invite_type, is_new, role_id, server_id, scene) {
            console.log("[SDK]分享过来的玩家上报给服务器");
            var sdk_token = wx.getStorageSync('plat_sdk_token');
            wx.request({
                url: 'https://' + HOST + '/game/min/?ac=updateShare',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: {
                    game_pkg: config.game_pkg,
                    partner_id: config.partner_id,
                    sdk_token: sdk_token,
                    invite: invite,
                    invite_type: invite_type,
                    is_new: is_new,
                    role_id: role_id,
                    sever_id: server_id,
                    scene: scene
                },
                success: function (res) {
                    console.log("[SDK]上报分享结果返回:");
                    console.log(res);
                }
            });
        },

        msgCheck: function (content, callback) {
            console.log("[SDK]查看文本是否有违规内容");
            var sdk_token = wx.getStorageSync('plat_sdk_token');
            wx.request({
                url: 'https://' + HOST + '/game/min/?ac=msgSecCheck',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: {
                    game_pkg: config.game_pkg,
                    partner_id: config.partner_id,
                    sdk_token: sdk_token,
                    content:content,
                },
                success: function (res) {
                    console.log("[SDK]查看文本是否有违规内容结果返回:");
                    console.log(res);
                    callback && callback(res);
                }
            });
        },

        pay: function (data, callback) {
            var self = this;
            self.startPay(data, callback);
        },

        //支付接口
        startPay: function (data, callback) {
            console.log("[SDK]调起支付，CP传值：",data);
            var self = this;
            callbacks['pay'] = typeof callback == 'function' ? callback : null;
            //先下单
            var sdk_token = wx.getStorageSync('plat_sdk_token');
            var session_key = wx.getStorageSync('plat_session_key');
            if (!sdk_token && !session_key) {
                callbacks['pay'] && callbacks['pay'](1, {errMsg: "用户未登录，支付失败！"});
                return;
            }

            var sysInfo = wx.getSystemInfoSync();


            var order_data = {
                cpbill: data.cpbill,
                productid: data.productid,
                productname: data.productname,
                productdesc: data.productdesc,
                serverid: data.serverid,
                servername: data.servername,
                roleid: data.roleid,
                rolename: data.rolename,
                rolelevel: data.rolelevel,
                price: data.price,
                extension: data.extension,
                sdk_token: sdk_token,
                session_key: session_key,
                platform: sysInfo.platform,
                session_3rd: partner_data.session_3rd,
            };
            self.order_data = order_data;

            var public_data = self.getPublicData();
            public_data['order_data'] = JSON.stringify(order_data);
            public_data['is_from_min'] = 1;

            //发起网络请求
            wx.request({
                url: 'https://' + HOST + '/partner/order',
                method: 'POST',
                dataType: 'json',
                header: {
                    'content-type': 'application/x-www-form-urlencoded' // 默认值
                },
                data: public_data,
                success: function (res) {
                    console.log("[SDK]完成创建订单");
                    console.log(res);
                    if (res.statusCode === 200) {
                        var data = res.data;
                        if (data.state && data.data.pay_data) {
                            //TODO 替换对应方法
                            console.log("[SDK]联运支付参数"+JSON.stringify(data.data.pay_data));
                            if(data.data.pay_data.pay_type=='kf'){
                                wx.openCustomerServiceConversation({
                                    showMessageCard:true,
                                    sendMessageTitle : data.data.pay_data.message,
                                    sessionFrom : data.data.pay_data.session_from,
                                    success : function (res) {
                                        console.log("[SDK]前往客服支付成功",res)
                                    },
                                    fail : function (res) {
                                        console.log("[SDK]前往客服支付失败",res)
                                    },
                                });
                            }else if(data.data.pay_data.pay_type=='xcx'){
                                wx.navigateToMiniProgram({
                                    appId :  data.data.pay_data.appid,
                                    path : data.data.pay_data.path + '?orderid=' + data.data.pay_data.orderid,
                                    success : function (res) {
                                        console.log("[SDK]跳转成功支付",res)
                                    },
                                    fail : function (res) {
                                        console.log("[SDK]跳转失败支付",res)
                                    },
                                });
                            }else if(data.data.pay_data.pay_type=='midashi'){
                                if(data.data.pay_data.pay_status===0){
                                    //余额不足
                                    wx.requestMidasPayment({
                                        mode: data.data.pay_data.mode,
                                        env: data.data.pay_data.env,
                                        offerId: data.data.pay_data.offerId,
                                        currencyType: data.data.pay_data.currencyType,
                                        platform: data.data.pay_data.platform,
                                        buyQuantity: data.data.pay_data.buyQuantity,
                                        zoneId: data.data.pay_data.zoneId,
                                        success : function (res) {
                                            console.log("[SDK]米大师支付成功",res)
                                        },
                                        fail : function (res) {
                                            console.log("[SDK]米大师支付失败",res)
                                        },
                                    });
                                }else{
                                    wx.showModal({
                                        title: "支付提示",
                                        content: "本次支付将扣除" + data.data.pay_data.buyQuantity + '游戏币',
                                        showCancel: false,
                                        confirmText: "我知道了",
                                        success: function () {
                                            console.log("[SDK]米大师扣除余额成功")
                                        }
                                    });
                                }
                                
                            }else{
                                console.log("[SDK]下单类型错误");
                            } 

                        } else {
                            callbacks['pay'] && callbacks['pay'](1, {errMsg: data.errMsg});
                        }
                    } else {
                        callbacks['login'] && callbacks['login'](1, {errMsg: '请求平台服务器失败！'});
                    }
                }
            });
        },

        logCreateRole: function (data) {
            var uid = wx.getStorageSync('plat_uid');
            var username = wx.getStorageSync('plat_username');

            var postData = {};
            postData['user_id'] = uid;
            postData['user_name'] = username;
            postData['role_id'] = data.roleid;
            postData['role_lev'] = data.rolelevel;
            postData['role_name'] = data.rolename;
            postData['server_id'] = data.serverid;

            if (data.roleid && data.serverid) {
                user_game_info = {
                    role_id: data.roleid,
                    server_id: data.serverid,
                };
            }
            this.log('create', postData);

            data.new_role = 1;
            this.reportChannelRole(data);
        

        },


        //进入游戏
        logEnterGame: function (data) {
            var uid = wx.getStorageSync('plat_uid');
            var username = wx.getStorageSync('plat_username');

            var postData = {};
            postData['user_id'] = uid;
            postData['user_name'] = username;
            postData['role_id'] = data.roleid;
            postData['role_lev'] = data.rolelevel;
            postData['role_name'] = data.rolename;
            postData['server_id'] = data.serverid;

            if (data.roleid && data.serverid) {
                user_game_info = {
                    role_id: data.roleid,
                    server_id: data.serverid,
                };
            }

            this.log('enter', postData);

            //进入游戏确认邀请成功
            if (user_invite_info) {
                this.updateShare(user_invite_info.invite, user_invite_info.invite_type, user_invite_info.is_new, data.roleid, data.serverid, user_invite_info.scene);
            }
        },

        //角色升级
        logRoleUpLevel: function (data) {
            var uid = wx.getStorageSync('plat_uid');
            var username = wx.getStorageSync('plat_username');
            this.log('levelup', data);

            var postData = {};
            postData['user_id'] = uid;
            postData['user_name'] = username;
            postData['role_id'] = data.roleid;
            postData['role_lev'] = data.rolelevel;
            postData['role_name'] = data.rolename;
            postData['server_id'] = data.serverid;

            if (data.roleid && data.serverid) {
                user_game_info = {
                    role_id: data.roleid,
                    server_id: data.serverid,
                };
            }

            data.new_role = 0;
            this.reportChannelRole(data);
        },

        reportChannelRole: function (data) {
            wx.request({
                url: 'https://gameluotuo.cn/index.php?g=Home&m=GameOauth&a=xyx_roles',
                method: 'GET',
                dataType: 'json',
                data: {
                    session_3rd:partner_data.session_3rd,
                    channel_id:config.partner_channel_id,
                    area : data.servername,
                    role_name : data.rolename,
                    new_role : data.new_role,
                    rank : data.rolelevel,
                    money : data.goldnum ? data.goldnum : 0,
                },
                success: function (res) {
                    console.log('[SDK]角色上报回调：', res)
                        
                }
            });
        },

        subscribeMsg: function () {
            


            wx.request({
                url: 'https://gameluotuo.cn/index.php?g=Wap&m=Mwxaapi&a=templatemsg',
                method: 'GET',
                dataType: 'json',
                data: {
                    session_3rd : partner_data.session_3rd,
                    token : config.partner_token,
                },
                success: function (res) {
                    console.log('[SDK]获取订阅模板回调：', res)
                    if(res.data.status===1001){
                        wx.onTouchEnd(function () {
                            var template_id = res.data.data[0].template_id;
                            wx.requestSubscribeMessage({
                                tmplIds: [template_id],
                                success (res) {
                                    console.log('[SDK]订阅回调：', res)
                                    if(res.errMsg=='requestSubscribeMessage:ok'){
                                        console.log('[SDK]订阅成功')
                                        wx.request({
                                            url: 'https://gameluotuo.cn/index.php?g=Wap&m=Wxaapi&a=for_template_all',
                                            method: 'GET',
                                            dataType: 'json',
                                            data: {
                                                session_3rd : partner_data.session_3rd,
                                                token : config.partner_token,
                                                appid : config.appid,
                                                template_id : template_id
                                            },
                                            success: function (res) {
                                                console.log('[SDK]发送订阅消息接口回调：', res)
                                            
                                            },
                                    
                                        });
                                    }
                                    
                                },
                                fail: function (res) {
                                    console.log('[SDK]订阅失败：', res)
                                },
                                complete:function (res) {
                                    console.log('111111')
                                    wx.offTouchEnd(function () {
                                        console.log('取消监听');
                                    });
                                    console.log('222222')
                                }
                            });
                        });
                        
                    }
                    

                
                }
            });
        },

        //账号安全（跳转小程序）
        accountSecurity: function () {
            
            var openid = wx.getStorageSync('plat_openid');
            var obj = {
                appId: config.jump_appid,
                path: config.jump_path + '&uid=' + openid,
                success: function (res) {
                    console.log("[SDK]跳转小程序成功")
                },
                fail: function (res) {
                    console.log("[SDK]跳转小程序失败")
                }
            }
            wx.navigateToMiniProgram(
                obj
            );
        },


        //获取唯一设备码（自定义）
        uuid: function (radix, len) {
            var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
            var uuid = [],
                i;
            radix = radix || chars.length;

            if (len) {
                for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
            } else {
                var r;

                uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
                uuid[14] = '4';

                for (i = 0; i < 36; i++) {
                    if (!uuid[i]) {
                        r = 0 | Math.random() * 16;
                        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                    }
                }
            }

            return uuid.join('');
        },

        //获取公共参数
        getPublicData: function () {
            var system = wx.getSystemInfoSync();
            var uuid = wx.getStorageSync('plat_uuid');
            var idfv = wx.getStorageSync('plat_idfv');
            var ad_code = wx.getStorageSync('plat_ad_code');

            return {
                game_id: config.game_id,
                game_pkg: config.game_pkg,
                partner_id: config.partner_id,
                partner_label: config.partner_label,
                ad_code: ad_code,
                uuid: uuid,
                idfv: idfv,
                dname: system.model,
                mac: '0000',
                net_type: system.wifiSignal == 0 ? '4G' : 'WIFI',
                os_ver: system.system,
                sdk_ver: system.version, //存放的是微信版本号
                game_ver: config.game_ver, //存放的是SDK版本号
                device: system.platform == 'android' ? 1 : 2,
            };
        },

        //统一发送log
        log: function (type, data) {
            var public_data = this.getPublicData();
            for (var key in data) {
                public_data[key] = data[key];
            }

            console.log("[SDK]上报数据：" + type);
            console.log(public_data);

            wx.request({
                url: 'https://' + HOST + '/partner/h5Log/?type=' + type + '&data=' + encodeURIComponent(JSON.stringify(public_data))
            });
        },

        getDate: function () {
            var date = new Date();
            return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
        },

        downloadClient: function () {
            wx.openCustomerServiceConversation();
        }
    }
}

function run(method, data, callback) {
    (method in PARTNER_SDK) && PARTNER_SDK[method](data, callback);
}


exports.init = function (data, callback) {
    run('init', data, callback);
};

exports.login = function (callback) {
    run('login', '', callback);
};
exports.pay = function (data, callback) {
    run('pay', data, callback);
};
exports.openService = function () {
    run('openService');
};
exports.logCreateRole = function (serverId, serverName, roleId, roleName, roleLevel) {
    var data = {
        serverid: serverId,
        servername: serverName,
        roleid: roleId,
        rolename: roleName,
        rolelevel: roleLevel,
    };
    run('logCreateRole', data);
};
exports.logEnterGame = function (serverId, serverName, roleId, roleName, roleLevel, rolecreatetime, extra) {
    var data = {
        serverid: serverId,
        servername: serverName,
        roleid: roleId,
        rolename: roleName,
        rolelevel: roleLevel,
        rolecreatetime: rolecreatetime,
        goldnum : extra.goldnum
    };

    run('logEnterGame', data);
};

exports.logRoleUpLevel = function (serverId, serverName, roleId, roleName, roleLevel, rolecreatetime, extra) {
    var data = {
        serverid: serverId,
        servername: serverName,
        roleid: roleId,
        rolename: roleName,
        rolelevel: roleLevel,
        rolecreatetime: rolecreatetime,
        goldnum: extra.goldnum,
    };
    run('logRoleUpLevel', data);
};

exports.share = function (type) {
    var data = {
        type: type
    };
    run('share', data);
};

exports.msgCheck = function (data, callback) {
    run('msgCheck', data, callback);
};
exports.downloadClient = function () {
    run('downloadClient');
};
exports.getConfig = function () {
    return {
        game_id: config.game_id,
        game_pkg: config.game_pkg,
        partner_id: config.partner_id
    }
};
exports.getPublicData = function () {
    run('getPublicData');
};
exports.subscribeMsg = function () {
    run('subscribeMsg');
};
exports.accountSecurity = function () {
    run('accountSecurity');
};