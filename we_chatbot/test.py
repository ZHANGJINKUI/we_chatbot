class MultiheadAttention(nn.Module):
    def _init_(self):
        super().init_()
        self.w_q=nn.Linear(d_model,n_heads*d_k)
        self.w_k=nn.Linear(d_model,n_heads*d_k)
        self.w_v=nn.Linear(d_model,n_heads*d_v)
        
        self.Linear=nn.Linear(n_heads*d_k,d_model)
        self.dropout=nn.Dropout(dropout)
        self.layernorm==nn.Layernorm(d_model)
    
    def forward(self,Q,K,V,attn_mask):
        batch_size,n_heads=Q.size(0),Q.size(1)
        q_s=self.w_q(Q).view(batch_size,seq_len,n_heads,d_k).transpose(1,2)
        k_s=self.w_k(K).view(batch_size,seq_len,n_heads,d_k).transpose(1,2)
        v_s=self.w_v(V).view(batch_size,seq_len,n_heads,d_v).transpose(1,2)
        scores=torch.matmul(q_s,k_s.transpose(-1,-2))/sqrt(d_k)

        mask=attn_mask.unsqueeze(1).repeat(1,n_heads,1,1)     
        scores.masked_fill(mask,-1e9)   
        attn_scores=torch.softmax(scores,dim=-1)
        attn_scores=torch.matmul(attn_scores,v_s)

        attn_scores=attn_scores.transpose(1,2).contiguous().view(batch_size,seq_len,-1)
        output=self.Linear(attn_scores)
        return self.layernorm(Q+self.dropout(output))

class FFN(nn.Module):
    def _init_(self):
        super()._init_()
        self.Linear=nn.Linear(d_model,4*d_model)
        self.relu=nn.ReLU()
        self.linear=nn.Linear(4*d_model,d_model)
        self.dropout=nn.Dropout(dropout)
        
    def forward(self,x):
        residual=x
        x=self.Linear(x)
        x=self.relu(x)
        x=self.linear(x)
        return self.layernorm(residual+self.dropout(x))

class EncoderLayer(nn.Module):
    def _init_(self):
        super()._init_()


        self.self_attn=MultiheadAttention()
        self.layernorm1=nn.LayerNorm(d_model)
        self.dropout1=nn.Dropout(dropout)
        self.ffn=FFN()
        self.layernorm2=nn.LayerNorm(d_model)
        self.dropout2=nn.Dropout(dropout)

    def forward(self,x,attn_mask):

        attn=self.self_attn(x,x,x,attn_mask)
        attn=self.dropout1(attn)
        attn=self.layernorm1(attn)
        output1=self.ffn(attn+x)
        ffn=self.dropout2(output1)
        output2=self.layernorm2(ffn+attn)
        return output2

class Encoder(nn.Module):
    
        