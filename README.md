# antd-form-demo

根据代码执行顺序梳理逻辑，这里列举简单例子，create时不穿任何参数

## 1、调用Form.create()(MyForm)

* 产生一个新容器组件Form，内置getFieldsValue等属性和方法。
* 复制被包裹组件的静态属性到新组建中。

## 2、新组件Form的render

* 执行声明周期事件，主要是： getInitialState 初始化默认的field，这里默认无
* render函数之间返回被包裹的元素，但是被注入了Form组件的属性

----

接下来进行表单项的绑定。

## 3、使用getFieldDecorator绑定表单项

``` js
{getFieldDecorator('userName', {
    rules: [{ required: true, message: 'Please input your username!' }],
    })(
    <Input prefix={<Icon type="user" style={{ color: 'rgba(0,0,0,.25)' }} />} placeholder="Username" />
)}
```

getFieldDecorator需要传递如下参数：
* 字段名
* 字段描述信息，如验证信息rules
* 存储字段相关信息：fieldsStore[字段名]={rules：{},value:{},onChange(){}}
* onChange事件会自动触发验证条件。
* 返回一个高阶函数，需要传递input进行绑定。

## 4、传入input组件

* 给组件注入属性，例如：onChange事件等
* 双向绑定完成，更改字段会同时改变fieldsStore[字段名]中的值。


## 总结

Form内部有一套自己的状态管理：fieldsStore,上面记录着所有表单项的信息，通过getFieldDecorator和表单进行双向绑定。